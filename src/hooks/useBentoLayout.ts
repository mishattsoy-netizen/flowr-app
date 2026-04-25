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
  validateLayout,
  recoverLayout
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
    const initial = DEFAULT_LAYOUTS[contextId] ?? DEFAULT_LAYOUTS['workspace'] ?? [];
    const balanced = rebalanceAll(initial);
    return validateLayout(balanced).valid ? balanced : initial;
  });
  const [editMode, setEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Drag & Preview State
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [previewLayout, setPreviewLayout] = useState<BentoLayoutItem[] | null>(null);
  const [swapTargetId, setSwapTargetId] = useState<string | null>(null);
  const [stackTargetId, setStackTargetId] = useState<string | null>(null);

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
        const balanced = compactLayout(rebalanceAll(items));
        if (validateLayout(balanced).valid) {
          setLayout(balanced);
        } else {
          const recovered = recoverLayout(items);
          if (recovered) {
            console.warn("[useBentoLayout] Saved layout recovered after clamping invalid values.");
            setLayout(recovered);
          } else {
            console.error("[useBentoLayout] Saved layout is invalid and unrecoverable, using default.");
            const defaults = rebalanceAll(DEFAULT_LAYOUTS[contextId] ?? DEFAULT_LAYOUTS['workspace'] ?? []);
            setLayout(defaults);
          }
        }
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

    // Prevent adding duplicates
    if (layoutRef.current.some(it => it.type === type)) {
      console.warn(`Widget of type ${type} is already present in the layout.`);
      return;
    }

    if (layoutRef.current.length >= MAX_WIDGETS) {
      alert(`Maximum of ${MAX_WIDGETS} widgets allowed.`);
      return;
    }

    // Try to find a slot that actually fits without breaking the layout
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

    // To prevent the "Adding breaks everything" bug:
    // We first create a trial layout, rebalance it, and check if it's valid.
    const trialLayout = [...layoutRef.current, newItem];
    const balancedTrial = rebalanceAll(trialLayout);
    const validation = validateLayout(balancedTrial);

    if (!validation.valid) {
      console.warn("Trial layout invalid, attempting to make room by shrinking others:", validation.error);
      
      // Attempt to make room: shrink all native widgets in the target row to their minW
      const shrunkLayout = layoutRef.current.map(it => {
        if (it.row === slot.row) {
          return { ...it, w: widgetRegistry[it.type]?.minW ?? 2 };
        }
        return it;
      });
      
      const balancedShrunk = rebalanceAll([...shrunkLayout, newItem]);
      if (validateLayout(balancedShrunk).valid) {
        commitLayout(balancedShrunk);
        return;
      }
      
      alert('Could not fit widget without breaking layout. Try removing another widget first.');
      return;
    }

    commitLayout(trialLayout);
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

    // Origin detection: pointer is still over the dragged widget's original cell
    // Only bail if we're hovering the dragged widget itself (targetId === draggedId)
    if (targetId === draggedId) {
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
      setPreviewLayout(layoutRef.current);
      setSwapTargetId(null);
      setStackTargetId(null);
      return;
    }

    if (currentHoverRef.current.id !== targetId) {
      currentHoverRef.current = { id: targetId, row, order: null };
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);

      const targetItem = layoutRef.current.find(it => it.i === targetId);
      const draggedItem = layoutRef.current.find(it => it.i === draggedId);

      const isStackedWidget = targetItem?.type === 'stacked-widgets';
      const canStack = isStackedWidget && targetItem && (!targetItem.data?.widgets || targetItem.data.widgets.length < 3) && draggedItem && draggedItem.type !== 'stacked-widgets';

      if (canStack) {
        setStackTargetId(targetId);
        setSwapTargetId(null);
        dwellTimerRef.current = setTimeout(() => {
          setStackTargetId(null);
          setSwapTargetId(targetId);
          setPreviewLayout(calculateSwapLayout(layoutRef.current, draggedId, targetId));
          dwellTimerRef.current = setTimeout(() => {
             setSwapTargetId(null);
          }, DWELL_DELAY_MS);
        }, 1200); // Wait 1.2s before switching to swap mode
      } else {
        setStackTargetId(null);
        setSwapTargetId(targetId);
        dwellTimerRef.current = setTimeout(() => {
          const swapped = calculateSwapLayout(layoutRef.current, draggedId, targetId);
          setPreviewLayout(swapped);
          // Keep swap highlight until pointer leaves this target
        }, DWELL_DELAY_MS);
      }
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
      setStackTargetId(null);
      return;
    }
    
    if (currentHoverRef.current.row !== row || currentHoverRef.current.order !== order) {
      currentHoverRef.current = { id: null, row, order };
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
      
      setSwapTargetId(null);
      setStackTargetId(null);
      
      dwellTimerRef.current = setTimeout(() => {
        const pushed = calculatePushLayout(layoutRef.current, draggedId, row, order);
        if (pushed) setPreviewLayout(pushed);
      }, DWELL_DELAY_MS);
    }
  }, [draggedId]);

  const handleDragEnd = useCallback(() => {
    if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    
    if (stackTargetId && draggedId) {
      const targetItem = layoutRef.current.find(it => it.i === stackTargetId);
      const draggedItem = layoutRef.current.find(it => it.i === draggedId);
      if (targetItem && draggedItem) {
        const currentWidgets = targetItem.data?.widgets || [];
        if (!currentWidgets.includes(draggedItem.type)) {
          const nextWidgets = [...currentWidgets, draggedItem.type];
          
          // Remove the dragged item from the layout
          const layoutWithoutDragged = layoutRef.current.filter(it => it.i !== draggedId);
          // Update the stacked widget's data
          const nextLayout = layoutWithoutDragged.map(it => 
            it.i === stackTargetId 
              ? { ...it, data: { ...it.data, widgets: nextWidgets, activeTabIndex: nextWidgets.length - 1 } }
              : it
          );
          
          commitLayout(compactLayout(rebalanceAll(nextLayout)));
          
          setDraggedId(null);
          setPreviewLayout(null);
          setSwapTargetId(null);
          setStackTargetId(null);
          currentHoverRef.current = { id: null, row: null, order: null };
          return;
        }
      }
    }
    
    if (previewLayout && draggedId) {
      commitLayout(previewLayout);
    }
    
    setDraggedId(null);
    setPreviewLayout(null);
    setSwapTargetId(null);
    setStackTargetId(null);
    currentHoverRef.current = { id: null, row: null, order: null };
  }, [previewLayout, draggedId, commitLayout, stackTargetId]);

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
    stackTargetId,
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
