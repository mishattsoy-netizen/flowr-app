import { useRef, useState, useCallback } from 'react';
import type { EditorBlock } from '@/data/store';

const MAX_HISTORY = 100;

export function useCanvasHistory(initialBlocks: EditorBlock[]) {
  const stackRef = useRef<EditorBlock[][]>([initialBlocks]);
  const indexRef = useRef(0);
  const [, forceRender] = useState(0);

  const push = useCallback((blocks: EditorBlock[]) => {
    // Drop any redo states above current index
    stackRef.current = stackRef.current.slice(0, indexRef.current + 1);
    stackRef.current.push(blocks);
    if (stackRef.current.length > MAX_HISTORY) {
      stackRef.current.shift();
    } else {
      indexRef.current += 1;
    }
    forceRender(n => n + 1);
  }, []);

  const undo = useCallback((): EditorBlock[] | null => {
    if (indexRef.current <= 0) return null;
    indexRef.current -= 1;
    forceRender(n => n + 1);
    return stackRef.current[indexRef.current];
  }, []);

  const redo = useCallback((): EditorBlock[] | null => {
    if (indexRef.current >= stackRef.current.length - 1) return null;
    indexRef.current += 1;
    forceRender(n => n + 1);
    return stackRef.current[indexRef.current];
  }, []);

  const canUndo = indexRef.current > 0;
  const canRedo = indexRef.current < stackRef.current.length - 1;

  return { push, undo, redo, canUndo, canRedo };
}
