import { useEffect } from 'react';
import { useStore, EditorBlock } from '@/data/store';
import type { CanvasTool } from '@/components/canvas/CanvasToolbar';

export interface UseCanvasKeyboardArgs {
  entityId: string;
  selectedIds: Set<string>;
  activeTool: CanvasTool;
  editingBlockId: string | null;
  spaceHeldRef: React.RefObject<boolean>;
  history: { push: (blocks: EditorBlock[]) => void };
  setEditingBlockId: (id: string | null) => void;
  setSelectedPointIndex: (i: number | null) => void;
  setActiveTool: (tool: CanvasTool) => void;
  setSelectedIds: (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  updateCanvasBlocks: (updates: { id: string; updates: Partial<EditorBlock> }[]) => void;
  scheduleNudgeHistoryPush: () => void;
  deleteCanvasBlock: (id: string) => void;
  handleUndo: () => void;
  handleRedo: () => void;
  handleGroup: () => void;
  handleUngroup: () => void;
  handleDuplicateSelection: () => void;
}

// All window-level keydown/keyup handling for the canvas: undo/redo, group/ungroup,
// duplicate, the Escape chain, arrow-key nudge, tool shortcuts, space-to-pan, and
// delete/backspace. Extracted verbatim from CanvasPage — the effect body and its
// dependency array (with the original eslint-disable) are unchanged so re-subscription
// timing stays identical to before the extraction.
export function useCanvasKeyboard({
  entityId,
  selectedIds,
  activeTool,
  editingBlockId,
  spaceHeldRef,
  history,
  setEditingBlockId,
  setSelectedPointIndex,
  setActiveTool,
  setSelectedIds,
  updateCanvasBlocks,
  scheduleNudgeHistoryPush,
  deleteCanvasBlock,
  handleUndo,
  handleRedo,
  handleGroup,
  handleUngroup,
  handleDuplicateSelection,
}: UseCanvasKeyboardArgs) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); handleUndo(); return; }
        if (e.key === 'y' || (e.shiftKey && e.key === 'z')) { e.preventDefault(); handleRedo(); return; }
        if (e.key === 'g') {
          e.preventDefault();
          e.shiftKey ? handleUngroup() : handleGroup();
          return;
        }
        if (e.key === 'd') {
          e.preventDefault();
          handleDuplicateSelection();
          return;
        }
      }

      // Escape chain: text/label editing is handled at the input level (CanvasTextElement /
      // the label <input> both stopPropagation on Escape and blur themselves), so by the time
      // Escape reaches this window-level handler, editing is never text/label. Remaining steps,
      // in priority order: exit waypoint-edit → back to select tool → clear selection.
      if (e.key === 'Escape') {
        e.preventDefault();
        if (editingBlockId) {
          setEditingBlockId(null);
          setSelectedPointIndex(null);
        } else if (activeTool !== 'select' && activeTool !== 'move') {
          setActiveTool('select');
        } else if (selectedIds.size > 0) {
          setSelectedIds(new Set());
        }
        return;
      }

      // Arrow-key nudge: 1px, or 10px with Shift. Skipped entirely if nothing is selected.
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedIds.size > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const updates = useStore.getState().blocks
          .filter(b => selectedIds.has(b.id))
          .map(b => {
            const isLinear = b.type === 'shape' && ['arrow', 'line', 'freedraw'].includes(b.shapeKind ?? '');
            return isLinear
              ? { id: b.id, updates: { points: (b.points ?? []).map(([px, py]) => [px + dx, py + dy] as [number, number]) } }
              : { id: b.id, updates: { x: (b.x ?? 0) + dx, y: (b.y ?? 0) + dy } };
          });
        updateCanvasBlocks(updates);
        scheduleNudgeHistoryPush();
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'v':
          setActiveTool('select');
          break;
        case 'h': setActiveTool('move'); break;
        case 'r': setActiveTool('rect'); break;
        case 'o': setActiveTool('ellipse'); break;
        case 'd': setActiveTool('diamond'); break;
        case 'a': setActiveTool('arrow'); break;
        case 'l': setActiveTool('line'); break;
        case 'p': setActiveTool('freedraw'); break;
        case 't': setActiveTool('text'); break;
        case 'i': setActiveTool('image'); break;
        case 'f': setActiveTool('frame'); break;
        case 'e': setActiveTool('eraser'); break;
        case ' ':
          spaceHeldRef.current = true;
          e.preventDefault();
          break;
        case 'delete': case 'backspace':
          selectedIds.forEach(id => deleteCanvasBlock(id));
          setSelectedIds(new Set());
          history.push(useStore.getState().blocks.filter(b => b.canvasId === entityId));
          break;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ') spaceHeldRef.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [selectedIds, activeTool, editingBlockId]); // eslint-disable-line react-hooks/exhaustive-deps
}
