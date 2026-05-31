'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { BentoLayoutItem, BentoLayout } from '@/components/bento/types';
import { widgetRegistry } from '@/components/bento/registry';
import { loadBentoLayout, saveBentoLayout } from '@/lib/bento-sync';
import {
  findFirstFit,
  rebalanceAll,
  fillGaps,
  compactLayout,
  resolveDrop,
  resizeDivider,
  computeGridPositions,
  validateLayout,
  recoverLayout
} from '@/lib/bento-engine';

const DEFAULT_LAYOUTS: Record<string, BentoLayoutItem[]> = {
  dashboard: [
    { i: 'dashboard-recent',         type: 'recent',      row: 0, order: 0, w: 2, h: 4 },
    { i: 'dashboard-tasks-today',    type: 'smart-tasks', row: 0, order: 1, w: 4, h: 2 },
    { i: 'dashboard-shortcuts',      type: 'shortcuts',   row: 2, order: 0, w: 4, h: 2 },
  ],
  workspace: [
    { i: 'ws-recent',    type: 'recent',      row: 0, order: 0, w: 2, h: 4 },
    { i: 'ws-tasks',     type: 'smart-tasks', row: 0, order: 1, w: 4, h: 2 },
    { i: 'ws-shortcuts', type: 'shortcuts',   row: 2, order: 0, w: 4, h: 2 },
  ],
};

const getCloneDefaults = (contextId: string) => {
  const raw = DEFAULT_LAYOUTS[contextId] ?? DEFAULT_LAYOUTS['workspace'] ?? [];
  return JSON.parse(JSON.stringify(raw));
};

const MAX_UNDO_DEPTH = 20;
const DWELL_DELAY_MS = 250;
const MAX_WIDGETS = 12;

export function useBentoLayout(contextId: string) {
  const [layout, setLayout] = useState<BentoLayoutItem[]>(() => {
    const initial = getCloneDefaults(contextId);
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<any>(null);
  const lastResolveRef = useRef<{ layout: BentoLayoutItem[] | null; failed: boolean }>({ layout: null, failed: false });

  // History State
  const [undoStack, setUndoStack] = useState<BentoLayout[]>([]);
  const [redoStack, setRedoStack] = useState<BentoLayout[]>([]);

  const layoutRef = useRef<BentoLayoutItem[]>(layout);
  const realLayoutRef = useRef<BentoLayoutItem[]>(layout);
  const debounceRef = useRef<any>(null);
  const dwellTimerRef = useRef<any>(null);
  const currentHoverRef = useRef<{ id: string | null; row: number | null; order: number | null; intent?: 'swap' | 'insert-before' | 'insert-after' }>({ id: null, row: null, order: null });
  const initialPosRef = useRef<{ row: number; col: number; w: number; h: number } | null>(null);

  layoutRef.current = previewLayout ?? layout;
  realLayoutRef.current = layout;

  const debouncedSave = useCallback((nextItems: BentoLayoutItem[]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveBentoLayout(contextId, nextItems, [6, 6, 6, 6]), 500);
  }, [contextId]);

  useEffect(() => {
    loadBentoLayout(contextId).then(saved => {
      if (saved) {
        // Migration: Fix legacy 'upcoming' type
        const items = saved.items.map(it => it.type === 'upcoming' ? { ...it, type: 'recent' } : it);
        // Always run recoverLayout first — it clamps w/h to current registry bounds,
        // which migrates saved layouts when constraints change (e.g. minH 1→2).
        const recovered = recoverLayout(items) ?? compactLayout(rebalanceAll(items));
        if (validateLayout(recovered).valid) {
          setLayout(recovered);
          // Persist the migrated layout if it changed from the loaded layout
          const hasChanges = JSON.stringify(items) !== JSON.stringify(recovered);
          if (hasChanges) {
            console.log(`[useBentoLayout] Migrating and persisting layout for ${contextId}`);
            debouncedSave(recovered);
          }
        } else {
          console.error("[useBentoLayout] Saved layout is invalid and unrecoverable, using default.");
          const defaults = rebalanceAll(getCloneDefaults(contextId));
          setLayout(defaults);
          debouncedSave(defaults);
        }
      }
      setTimeout(() => setIsLoading(false), 200);
    });
  }, [contextId, debouncedSave]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        saveBentoLayout(contextId, layoutRef.current, [6, 6, 6, 6]);
      }
    };
  }, [contextId]);

  const commitLayout = useCallback((nextItems: BentoLayoutItem[], skipHistory = false, skipRebalance = false) => {
    let balancedItems = skipRebalance ? nextItems : rebalanceAll(nextItems);

    const validation = validateLayout(balancedItems);
    if (!validation.valid) {
      const recovered = recoverLayout(nextItems);
      if (!recovered) {
        console.error("Layout validation failed (unrecoverable):", validation.error);
        return;
      }
      balancedItems = recovered;
    }

    // Compact rows (span-aware: include all cells a tall widget occupies)
    const occupied = new Set<number>();
    for (const it of balancedItems) {
      for (let r = it.row; r < it.row + it.h; r++) occupied.add(r);
    }
    const sortedRows = [...occupied].sort((a, b) => a - b);
    const remap = new Map<number, number>();
    sortedRows.forEach((oldRow, newRow) => remap.set(oldRow, newRow));
    const finalItems = balancedItems.map(it => ({ ...it, row: remap.get(it.row) ?? it.row }));

    if (!skipHistory) {
      setUndoStack(prev => [...prev.slice(-MAX_UNDO_DEPTH + 1), { items: realLayoutRef.current, rowHeights: [6, 6, 6, 6] }]);
      setRedoStack([]);
    }

    const withGapsFilled = fillGaps(finalItems);
    setLayout(withGapsFilled);
    debouncedSave(withGapsFilled);
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
    const defaults = rebalanceAll(getCloneDefaults(contextId));
    commitLayout(defaults);
  }, [commitLayout, contextId]);

  // ─── Drag Lifecycle ───────────────────────────────────────────────────────

  const handleDragStart = useCallback((id: string) => {
    const { positions } = computeGridPositions(realLayoutRef.current);
    const pos = positions.get(id);
    if (pos) {
      initialPosRef.current = { row: pos.y, col: pos.x, w: pos.w, h: pos.h };
    }
    setDraggedId(id);
    setPreviewLayout(realLayoutRef.current);
  }, []);

  const handleDragOverWidget = useCallback((targetId: string, row: number, col: number) => {
    if (!draggedId) return;

    // Origin detection: pointer is still over the dragged widget's original cell
    if (targetId === draggedId) {
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
      setPreviewLayout(realLayoutRef.current);
      setSwapTargetId(null);
      setStackTargetId(null);
      lastResolveRef.current = { layout: null, failed: false };
      return;
    }

    // Intent based on pointer position within target widget.
    // col is a coarse integer grid column — use it only for direction, not fine zones.
    // A widget of w=2 only has 2 possible col values, so we can't reliably detect
    // narrow edge bands. Default to swap; only insert when pointer is in the outermost col.
    const { positions } = computeGridPositions(realLayoutRef.current);
    const targetPos = positions.get(targetId);
    let intent: 'swap' | 'insert-before' | 'insert-after' = 'swap';
    if (targetPos && targetPos.w > 2) {
      // Only use insert-before/after on wider widgets where col resolution is meaningful
      const relX = (col - targetPos.x) / Math.max(1, targetPos.w);
      if (relX < 0.15) intent = 'insert-before';
      else if (relX > 0.85) intent = 'insert-after';
    }

    // Re-trigger when target OR intent changes (so moving within a widget can switch modes).
    const hoverKey = `${targetId}:${intent}`;
    const prevHoverKey = currentHoverRef.current.id ? `${currentHoverRef.current.id}:${currentHoverRef.current.intent ?? 'swap'}` : null;

    if (hoverKey !== prevHoverKey) {
      currentHoverRef.current = { id: targetId, row, order: null, intent };
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);

      const targetItem = layoutRef.current.find(it => it.i === targetId);
      const draggedItem = layoutRef.current.find(it => it.i === draggedId);

      const isStackedWidget = targetItem?.type === 'stacked-widgets';
      const canStack = isStackedWidget && targetItem && (!targetItem.data?.widgets || targetItem.data.widgets.length < 3) && draggedItem && draggedItem.type !== 'stacked-widgets' && intent === 'swap';

      if (canStack) {
        setStackTargetId(targetId);
        setSwapTargetId(null);
        // Resolve immediately so a quick drop still commits correctly.
        const resolvedSwap = resolveDrop(realLayoutRef.current, draggedId, { kind: 'widget', id: targetId, intent: 'swap' });
        lastResolveRef.current = { layout: resolvedSwap, failed: resolvedSwap === null };
        // Delay the visual preview update to avoid jitter during rapid movement.
        dwellTimerRef.current = setTimeout(() => {
          setStackTargetId(null);
          setSwapTargetId(targetId);
          if (resolvedSwap) setPreviewLayout(resolvedSwap);
          dwellTimerRef.current = setTimeout(() => {
            setSwapTargetId(null);
          }, DWELL_DELAY_MS);
        }, 1200); // Wait 1.2s before switching to swap mode
      } else {
        setStackTargetId(null);
        setSwapTargetId(targetId);
        // Resolve immediately so a quick drop still commits correctly.
        const resolved = resolveDrop(realLayoutRef.current, draggedId, { kind: 'widget', id: targetId, intent });
        lastResolveRef.current = { layout: resolved, failed: resolved === null };
        // Delay the visual preview update to avoid jitter during rapid movement.
        dwellTimerRef.current = setTimeout(() => {
          if (resolved) setPreviewLayout(resolved);
          else setPreviewLayout(realLayoutRef.current);
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
      setPreviewLayout(realLayoutRef.current);
      setStackTargetId(null);
      lastResolveRef.current = { layout: null, failed: false };
      return;
    }

    if (currentHoverRef.current.row !== row || currentHoverRef.current.order !== order) {
      currentHoverRef.current = { id: null, row, order };
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);

      setSwapTargetId(null);
      setStackTargetId(null);

      // Resolve immediately so a quick drop still commits correctly.
      const resolved = resolveDrop(realLayoutRef.current, draggedId, { kind: 'empty', row, order });
      lastResolveRef.current = { layout: resolved, failed: resolved === null };
      // Delay visual preview to avoid jitter during rapid pointer movement.
      dwellTimerRef.current = setTimeout(() => {
        if (resolved) setPreviewLayout(resolved);
        else setPreviewLayout(realLayoutRef.current);
      }, DWELL_DELAY_MS);
    }
  }, [draggedId]);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 2200);
  }, []);

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
          lastResolveRef.current = { layout: null, failed: false };
          currentHoverRef.current = { id: null, row: null, order: null };
          return;
        }
      }
    }

    // Use the stored resolved layout (resolved immediately on hover, not deferred like the preview).
    // This ensures quick drops commit correctly even if the dwell timer hasn't fired yet.
    const { layout: resolvedLayout, failed } = lastResolveRef.current;
    if (failed && draggedId) {
      showToast("Can't fit here");
    } else if (resolvedLayout && draggedId) {
      commitLayout(resolvedLayout);
    }
    // No fallback: if resolvedLayout is null and failed is false, the user dropped on origin — no-op.

    setDraggedId(null);
    setPreviewLayout(null);
    setSwapTargetId(null);
    setStackTargetId(null);
    lastResolveRef.current = { layout: null, failed: false };
    currentHoverRef.current = { id: null, row: null, order: null };
  }, [previewLayout, draggedId, commitLayout, stackTargetId, showToast]);

  const [verticalDividerDrag, setVerticalDividerDrag] = useState<{ topId: string, bottomId: string, startY: number } | null>(null);

  const handleDividerDragPreview = useCallback((
    leftId: string,
    rightId: string,
    newBoundary: number
  ) => {
    const current = layoutRef.current;
    const { positions } = computeGridPositions(current);
    const posL = positions.get(leftId);
    const posR = positions.get(rightId);
    if (!posL || !posR) return;
    const oldBoundary = posL.x + posL.w;
    if (newBoundary === oldBoundary) return;
    const movingRight = newBoundary > oldBoundary;
    const claimerId = movingRight ? leftId : rightId;
    const victimId  = movingRight ? rightId : leftId;
    let result = resizeDivider(current, claimerId, victimId, newBoundary, 'horizontal');
    if (!result) {
      // Case B (cell-claim) requires an all-or-nothing boundary snap.
      // If the dragged boundary doesn't land exactly on the full-claim position,
      // try the extreme boundary so the claim snaps as soon as the pointer crosses it.
      const posV = movingRight ? posR : posL;
      const extremeBoundary = movingRight ? posV.x + posV.w : posV.x;
      if (extremeBoundary !== newBoundary && extremeBoundary !== oldBoundary) {
        result = resizeDivider(current, claimerId, victimId, extremeBoundary, 'horizontal');
      }
    }
    if (result) setPreviewLayout(result);
  }, []);

  const handleDividerDragEnd = useCallback(() => {
    if (previewLayout && validateLayout(previewLayout).valid) {
      commitLayout(previewLayout, false, true);
    }
    setPreviewLayout(null);
  }, [previewLayout, commitLayout]);

  const handleVerticalDividerDragPreview = useCallback((
    topId: string,
    bottomId: string,
    newBoundary: number
  ) => {
    // Use layoutRef (preview-aware) so oldBoundary tracks the live position,
    // preventing claimer/victim flip when the preview has already shifted the boundary.
    const currentLayout = layoutRef.current;
    const { positions } = computeGridPositions(currentLayout);
    const posT = positions.get(topId);
    const posB = positions.get(bottomId);
    if (!posT || !posB) return;
    const oldBoundary = posT.y + posT.h;
    // Direction-aware: drag up → bottom widget is claimer (grows into top's space)
    const movingUp = newBoundary < oldBoundary;
    const claimerId = movingUp ? bottomId : topId;
    const victimId  = movingUp ? topId : bottomId;
    let result = resizeDivider(currentLayout, claimerId, victimId, newBoundary, 'vertical');
    if (!result) {
      // Case B (cell-claim) snap: try extreme boundary if intermediate fails.
      const posV = movingUp ? posT : posB;
      const extremeBoundary = movingUp ? posV.y : posV.y + posV.h;
      if (extremeBoundary !== newBoundary && extremeBoundary !== oldBoundary) {
        result = resizeDivider(currentLayout, claimerId, victimId, extremeBoundary, 'vertical');
      }
    }
    if (result) setPreviewLayout(result);
  }, []);

  const handleVerticalDividerDragEnd = useCallback(() => {
    if (previewLayout && validateLayout(previewLayout).valid) {
      commitLayout(previewLayout, false, true);
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
    isResizing: !!previewLayout,
    toastMessage
  };
}
