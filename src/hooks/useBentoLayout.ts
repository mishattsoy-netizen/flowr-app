'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { BentoLayoutItem, BentoLayout } from '@/components/bento/types';
import { widgetRegistry } from '@/components/bento/registry';
import { loadBentoLayout, saveBentoLayout } from '@/lib/bento-sync';
import {
  findFirstFit,
  rebalanceAll,
  compactLayout,
  calculateSwapLayout,
  calculatePushLayout,
  adjustDivider,
  adjustVerticalDivider,
  computeGridPositions,
  validateLayout
} from '@/lib/bento-engine';

const DEFAULT_LAYOUTS: Record<string, BentoLayoutItem[]> = {
  dashboard: [
    { i: 'dashboard-clock',          type: 'clock',       row: 0, order: 0, w: 2, h: 1 },
    { i: 'dashboard-tasks-today',    type: 'smart-tasks', row: 0, order: 1, w: 4, h: 2 },
    { i: 'dashboard-shortcuts',      type: 'shortcuts',   row: 1, order: 0, w: 2, h: 3 },
    { i: 'dashboard-recent',         type: 'recent',      row: 2, order: 1, w: 2, h: 2 },
    { i: 'dashboard-all-files',      type: 'all-files',   row: 2, order: 2, w: 2, h: 2 },
  ],
  workspace: [
    { i: 'ws-tasks',     type: 'smart-tasks', row: 0, order: 0, w: 4, h: 2 },
    { i: 'ws-all-files', type: 'all-files',   row: 0, order: 1, w: 2, h: 2 }, 
    { i: 'ws-shortcuts', type: 'shortcuts',   row: 1, order: 0, w: 6, h: 1 },
  ],
};

const MAX_UNDO_DEPTH = 20;
const DWELL_DELAY_MS = 250;
const MAX_WIDGETS = 12;

export function useBentoLayout(contextId: string) {
  const [layout, setLayout] = useState<BentoLayoutItem[]>(() => {
    return rebalanceAll(DEFAULT_LAYOUTS[contextId] ?? DEFAULT_LAYOUTS['workspace'] ?? []);
  });
  const [editMode, setEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Drag & Preview State
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [previewLayout, setPreviewLayout] = useState<BentoLayoutItem[] | null>(null);
  const [swapTargetId, setSwapTargetId] = useState<string | null>(null);

  // History State
  const [undoStack, setUndoStack] = useState<BentoLayout[]>([]);
  const [redoStack, setRedoStack] = useState<BentoLayout[]>([]);

  const layoutRef = useRef<BentoLayoutItem[]>(layout);
  const debounceRef = useRef<any>(null);
  const dwellTimerRef = useRef<any>(null);
  const currentHoverRef = useRef<{ id: string | null; row: number | null; order: number | null }>({ id: null, row: null, order: null });
  const initialPosRef = useRef<{ row: number; col: number; w: number; h: number } | null>(null);
  
  layoutRef.current = layout;

  useEffect(() => {
    loadBentoLayout(contextId).then(saved => {
      if (saved) {
        // Migration: Fix legacy 'upcoming' type
        const items = saved.items.map(it => it.type === 'upcoming' ? { ...it, type: 'recent' } : it);
        setLayout(compactLayout(rebalanceAll(items)));
      }
      setTimeout(() => setIsLoading(false), 200);
    });
  }, [contextId]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        saveBentoLayout(contextId, layoutRef.current, [6, 6, 6, 6]);
      }
    };
  }, [contextId]);

  const debouncedSave = useCallback((nextItems: BentoLayoutItem[]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveBentoLayout(contextId, nextItems, [6, 6, 6, 6]), 500);
  }, [contextId]);

  const commitLayout = useCallback((nextItems: BentoLayoutItem[], skipHistory = false) => {
    const balancedItems = rebalanceAll(nextItems);

    const validation = validateLayout(balancedItems);
    if (!validation.valid) {
      console.error("Layout validation failed:", validation.error);
      return;
    }

    // Compact items
    const usedRows = [...new Set(balancedItems.map(it => it.row))].sort((a, b) => a - b);
    const remap = new Map(usedRows.map((r, i) => [r, i]));
    const finalItems = balancedItems.map(it => ({ ...it, row: remap.get(it.row) ?? it.row }));

    if (!skipHistory) {
      setUndoStack(prev => [...prev.slice(-MAX_UNDO_DEPTH + 1), { items: layoutRef.current, rowHeights: [6, 6, 6, 6] }]);
      setRedoStack([]);
    }

    setLayout(finalItems);
    debouncedSave(finalItems);
  }, [debouncedSave]);

  // Keyboard Shortcuts (Undo/Redo)
  useEffect(() => {
    if (!editMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editMode, undoStack, redoStack]);

  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const previousState = next.pop()!;
      setRedoStack(r => [...r, { items: layoutRef.current, rowHeights: [6, 6, 6, 6] }]);
      setLayout(previousState.items);
      debouncedSave(previousState.items);
      return next;
    });
  }, [debouncedSave]);

  const redo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const nextState = next.pop()!;
      setUndoStack(u => [...u, { items: layoutRef.current, rowHeights: [6, 6, 6, 6] }]);
      setLayout(nextState.items);
      debouncedSave(nextState.items);
      return next;
    });
  }, [debouncedSave]);

  // ─── Widget operations ────────────────────────────────────────────────────

  const addWidget = useCallback((type: string) => {
    const entry = widgetRegistry[type];
    if (!entry) return;

    if (layoutRef.current.length >= MAX_WIDGETS) {
      alert(`Maximum of ${MAX_WIDGETS} widgets allowed.`);
      return;
    }

    const slot = findFirstFit(layoutRef.current, entry.defaultW, entry.defaultH);
    if (!slot) {
      alert('Dashboard is full. Remove some widgets to make room.');
      return;
    }

    const newItem: BentoLayoutItem = {
      i: crypto.randomUUID(),
      type,
      row: slot.row,
      order: slot.order,
      w: entry.defaultW,
      h: entry.defaultH,
    };

    // Insert normally
    commitLayout([...layoutRef.current, newItem]);
  }, [commitLayout]);

  const removeWidget = useCallback((instanceId: string) => {
    commitLayout(layoutRef.current.filter(item => item.i !== instanceId));
  }, [commitLayout]);

  const updateWidgetData = useCallback((instanceId: string, newData: any) => {
    setLayout(prev => {
      const next = prev.map(item =>
        item.i === instanceId ? { ...item, data: newData } : item
      );
      debouncedSave(next);
      return next;
    });
  }, [debouncedSave]);

  const toggleEditMode = useCallback(() => {
    setEditMode(prev => {
      if (prev) saveBentoLayout(contextId, layoutRef.current, [6, 6, 6, 6]);
      return !prev;
    });
  }, [contextId]);

  const resetLayout = useCallback(() => {
    const defaults = rebalanceAll(DEFAULT_LAYOUTS[contextId] ?? DEFAULT_LAYOUTS['workspace'] ?? []);
    commitLayout(defaults);
  }, [commitLayout, contextId]);

  // ─── Drag Lifecycle ───────────────────────────────────────────────────────

  const handleDragStart = useCallback((id: string) => {
    const { positions } = computeGridPositions(layoutRef.current);
    const pos = positions.get(id);
    if (pos) {
      initialPosRef.current = { row: pos.y, col: pos.x, w: pos.w, h: pos.h };
    }
    setDraggedId(id);
    setPreviewLayout(layoutRef.current);
  }, []);

  const handleDragOverWidget = useCallback((targetId: string, row: number, col: number) => {
    if (!draggedId) return;

    // Origin detection: Check if current pointer is within original widget area
    if (initialPosRef.current && 
        row >= initialPosRef.current.row && 
        row < initialPosRef.current.row + initialPosRef.current.h &&
        col >= initialPosRef.current.col && 
        col < initialPosRef.current.col + initialPosRef.current.w) {
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
      currentHoverRef.current = { id: targetId, row, order: null };
      setPreviewLayout(layoutRef.current);
      setSwapTargetId(null);
      return;
    }

    if (currentHoverRef.current.id !== targetId) {
      currentHoverRef.current = { id: targetId, row, order: null };
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
      
      setSwapTargetId(targetId);
      
      dwellTimerRef.current = setTimeout(() => {
        setPreviewLayout(calculateSwapLayout(layoutRef.current, draggedId, targetId));
        setSwapTargetId(null);
      }, DWELL_DELAY_MS);
    }
  }, [draggedId]);

  const handleDragOverEmpty = useCallback((row: number, order: number, col: number) => {
    if (!draggedId) return;

    // Origin detection: Check if current pointer is within original widget area
    if (initialPosRef.current && 
        row >= initialPosRef.current.row && 
        row < initialPosRef.current.row + initialPosRef.current.h &&
        col >= initialPosRef.current.col && 
        col < initialPosRef.current.col + initialPosRef.current.w) {
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
      currentHoverRef.current = { id: null, row, order };
      setPreviewLayout(layoutRef.current);
      return;
    }
    
    if (currentHoverRef.current.row !== row || currentHoverRef.current.order !== order) {
      currentHoverRef.current = { id: null, row, order };
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
      
      setSwapTargetId(null);
      
      dwellTimerRef.current = setTimeout(() => {
        const pushed = calculatePushLayout(layoutRef.current, draggedId, row, order);
        if (pushed) setPreviewLayout(pushed);
      }, DWELL_DELAY_MS);
    }
  }, [draggedId]);

  const handleDragEnd = useCallback(() => {
    if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    
    if (previewLayout && draggedId) {
      commitLayout(previewLayout);
    }
    
    setDraggedId(null);
    setPreviewLayout(null);
    setSwapTargetId(null);
    currentHoverRef.current = { id: null, row: null, order: null };
  }, [previewLayout, draggedId, commitLayout]);

  const [verticalDividerDrag, setVerticalDividerDrag] = useState<{ topId: string, bottomId: string, startY: number } | null>(null);

  const handleDividerDragPreview = useCallback((leftId: string, rightId: string, w0: number, w1: number) => {
    const current = previewLayout || layoutRef.current;
    const adjusted = adjustDivider(current, leftId, rightId, w0, w1);
    setPreviewLayout(compactLayout(rebalanceAll(adjusted)));
  }, [previewLayout]);

  const handleDividerDragEnd = useCallback(() => {
    if (previewLayout && validateLayout(previewLayout).valid) {
      commitLayout(previewLayout);
    }
    setPreviewLayout(null);
  }, [previewLayout, commitLayout]);

  const handleVerticalDividerDragPreview = useCallback((topId: string, bottomId: string, h0: number, h1: number) => {
    const current = previewLayout || layoutRef.current;
    const adjusted = adjustVerticalDivider(current, topId, bottomId, h0, h1);
    setPreviewLayout(compactLayout(rebalanceAll(adjusted)));
  }, [previewLayout]);

  const handleVerticalDividerDragEnd = useCallback(() => {
    if (previewLayout && validateLayout(previewLayout).valid) {
      commitLayout(previewLayout);
    }
    setPreviewLayout(null);
  }, [previewLayout, commitLayout]);

  return {
    layout: previewLayout ?? layout,
    realLayout: layout,
    editMode,
    isLoading,
    draggedId,
    swapTargetId,
    toggleEditMode,
    addWidget,
    removeWidget,
    updateWidgetData,
    resetLayout,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    handleDragStart,
    handleDragOverWidget,
    handleDragOverEmpty,
    handleDragEnd,
    handleDividerDragPreview,
    handleDividerDragEnd,
    handleVerticalDividerDragPreview,
    handleVerticalDividerDragEnd,
    isResizing: !!previewLayout
  };
}
