"use client";

import React, { useRef, useCallback, useEffect } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EditorBlock, BlockType, generateId } from '@/data/store';
import { formatCounter } from '@/lib/editor/markdownBlocks';

interface ListRow {
  id: string;
  content: string;
  checked?: boolean;
  depth: number;
}

function flattenRows(block: EditorBlock): ListRow[] {
  const rows: ListRow[] = [];

  function walk(items: EditorBlock[], depth: number) {
    for (const item of items) {
      rows.push({ id: item.id, content: item.content, checked: item.checked, depth });
      if (item.children) {
        walk(item.children, depth + 1);
      }
    }
  }

  rows.push({ id: block.id, content: block.content, checked: block.checked, depth: 0 });
  walk(block.children ?? [], 0);

  return rows;
}

function nestRows(rows: ListRow[], blockType: BlockType): { content: string; checked?: boolean; children: EditorBlock[] } {
  if (rows.length === 0) return { content: '', children: [] };

  function buildTree(items: ListRow[], minDepth: number): EditorBlock[] {
    const result: EditorBlock[] = [];
    let i = 0;
    while (i < items.length) {
      const row = items[i];
      if (row.depth < minDepth) break;
      const node: EditorBlock = { id: row.id, type: blockType, content: row.content, checked: row.checked };
      const childRows: ListRow[] = [];
      i++;
      while (i < items.length && items[i].depth > row.depth) {
        childRows.push(items[i]);
        i++;
      }
      if (childRows.length > 0) node.children = buildTree(childRows, row.depth + 1);
      result.push(node);
    }
    return result;
  }

  const first = rows[0];
  return {
    content: first.content,
    checked: first.checked,
    children: buildTree(rows.slice(1), 0),
  };
}

interface ListBlockProps {
  block: EditorBlock;
  listNumber?: number;
  onUpdate: (id: string, updates: Partial<EditorBlock>) => void;
  onExitBottom: () => void;
  onExitTop: () => void;
  onFocus?: (id: string) => void;
  isDraggingGlobal?: boolean;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

function RowEl({
  row,
  rowIndex,
  rows,
  blockType,
  listNumber,
  onRowUpdate,
  onKeyDown,
  onFocusBlock,
  registerRef,
  isDraggingGlobal = false,
  onMouseMove,
  onMouseLeave,
  onContextMenu,
}: {
  row: ListRow;
  rowIndex: number;
  rows: ListRow[];
  blockType: BlockType;
  listNumber?: number;
  onRowUpdate: (rowId: string, content: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, rowIndex: number) => void;
  onFocusBlock: () => void;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
  isDraggingGlobal?: boolean;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const lastContent = useRef<string | null>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const isInitialMount = lastContent.current === null;
    if (isInitialMount || (el.innerHTML !== row.content && row.content !== lastContent.current)) {
      el.innerHTML = row.content;
    }
    lastContent.current = row.content;
  }, [row.content]);

  useEffect(() => {
    registerRef(row.id, elRef.current);
    return () => registerRef(row.id, null);
  }, [row.id, registerRef]);

  const d = row.depth % 3;

  const marker = () => {
    if (blockType === 'bulletList') {
      if (d === 0) return <div className="w-[5.5px] h-[5.5px] rounded-full bg-[var(--bone-70)] flex-shrink-0" />;
      if (d === 1) return <div className="w-[5.5px] h-[5.5px] rounded-sm border border-[var(--bone-70)] flex-shrink-0" />;
      return <div className="w-[5.5px] h-[5.5px] bg-[var(--bone-70)] flex-shrink-0" />;
    }
    if (blockType === 'dashedList') {
      if (d === 0) return <div className="w-[8px] h-[1px] bg-[var(--bone-70)] flex-shrink-0" />;
      if (d === 1) return <div className="w-[6px] h-[1px] bg-[var(--bone-70)] flex-shrink-0" />;
      return <div className="w-[3px] h-[3px] rounded-full bg-[var(--bone-70)] flex-shrink-0" />;
    }
    if (blockType === 'numberedList') {
      const counterStyle = d === 0 ? 'arabic' : d === 1 ? 'alpha' : 'roman';
      let count = 0;
      for (let i = 0; i <= rowIndex; i++) {
        if (rows[i].depth === row.depth) count++;
        if (i < rowIndex && rows[i].depth < row.depth) count = 0;
      }
      if (rowIndex === 0 && row.depth === 0 && listNumber != null) count = listNumber;
      return <span className="text-bone-70/40 text-[16px] font-normal leading-[1.6]" style={{ fontFamily: '"Literata"', letterSpacing: '-0.01em' }}>{formatCounter(count, counterStyle)}.</span>;
    }
    return null;
  };

  return (
    <div className="flex items-start w-full py-0.5" style={{ paddingLeft: `${row.depth * 24}px` }}>
      <div 
        className="shrink-0 flex items-start justify-center mr-2.5 h-[1.7em]" 
        style={{ 
          width: '16px', 
          paddingTop: blockType === 'checklist' ? '5px' : (blockType === 'numberedList' ? '0px' : '11px') 
        }}
      >
        {blockType === 'checklist' ? (
          <div className={cn(
            "w-[16px] h-[16px] shrink-0 rounded-[4px] border flex items-center justify-center cursor-pointer border-[var(--bone-30)] hover:border-[var(--bone-70)] bg-[var(--app-dark)]",
            isDraggingGlobal && "pointer-events-none"
          )}
            onClick={isDraggingGlobal ? undefined : () => onRowUpdate(row.id, '__toggle_checked__')}
          >
            {row.checked && <Check className="w-[10px] h-[10px] text-[var(--bone-100)]" strokeWidth={3} />}
          </div>
        ) : (
          marker()
        )}
      </div>
      <div
        ref={elRef}
        contentEditable
        suppressContentEditableWarning
        className={cn(
          "flex-1 outline-none min-h-[1.5em] leading-[1.6] text-[16px] font-normal font-display tracking-[-0.02em]",
          row.checked ? "text-[var(--bone-30)]" : "text-bone-100",
        )}
        style={{
          fontFamily: '"Literata"',
          letterSpacing: '-0.01em',
          direction: 'ltr',
          ...(row.checked ? { textDecoration: 'line-through', textDecorationThickness: '1px', textDecorationColor: 'var(--bone-70)' } : {}),
        }}
        dir="ltr"
        onFocus={onFocusBlock}
        onInput={() => {
          const content = elRef.current?.innerHTML ?? '';
          lastContent.current = content;
          onRowUpdate(row.id, content);
        }}
        onKeyDown={e => onKeyDown(e, rowIndex)}
        onPaste={e => {
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, text);
        }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onContextMenu={onContextMenu}
      />
    </div>
  );
}

export function ListBlock({ block, listNumber, onUpdate, onExitBottom, onExitTop, onFocus, isDraggingGlobal = false, onMouseMove, onMouseLeave, onContextMenu }: ListBlockProps) {
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pendingFocusId = useRef<string | null>(null);
  // Keep a stable ref to current rows so keyboard handlers don't go stale
  const rowsRef = useRef<ListRow[]>(flattenRows(block));
  rowsRef.current = flattenRows(block);
  const ignoreNextInput = useRef(false);

  const registerRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  }, []);

  const focusRow = useCallback((id: string) => {
    const el = rowRefs.current.get(id);
    if (el) {
      el.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    } else {
      pendingFocusId.current = id;
    }
  }, []);

  useEffect(() => {
    const id = pendingFocusId.current;
    if (!id) return;
    pendingFocusId.current = null;
    focusRow(id);
  });

  const commitRows = useCallback((newRows: ListRow[], focusId?: string) => {
    if (newRows.length === 0) {
      onExitBottom();
      return;
    }
    const nested = nestRows(newRows, block.type);
    onUpdate(block.id, { content: nested.content, checked: nested.checked, children: nested.children });
    if (focusId) {
      pendingFocusId.current = focusId;
    }
  }, [block.id, block.type, onUpdate, onExitBottom]);

  const handleRowUpdate = useCallback((rowId: string, content: string) => {
    if (ignoreNextInput.current) {
      ignoreNextInput.current = false;
      return;
    }
    const rows = rowsRef.current;
    if (content === '__toggle_checked__') {
      const newRows = rows.map(r => r.id === rowId ? { ...r, checked: !r.checked } : r);
      commitRows(newRows, rowId);
      return;
    }
    const newRows = rows.map(r => r.id === rowId ? { ...r, content } : r);
    commitRows(newRows);
  }, [commitRows]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>, rowIndex: number) => {
    const rows = rowsRef.current;
    const row = rows[rowIndex];

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      ignoreNextInput.current = true;
      const el = rowRefs.current.get(row.id);
      const content = el?.innerHTML ?? '';

      if (!content.trim()) {
        if (row.depth > 0) {
          // Empty nested row: unindent
          const newRows = [...rows];
          newRows[rowIndex] = { ...row, depth: row.depth - 1 };
          commitRows(newRows, row.id);
        } else if (rowIndex === rows.length - 1) {
          // Last empty top-level row: remove it and exit list
          const newRows = rows.slice(0, rowIndex);
          if (newRows.length === 0) { onExitTop(); return; }
          commitRows(newRows);
          onExitBottom();
        } else {
          // Empty top-level row in middle: exit list (convert block to text)
          onExitBottom();
        }
        return;
      }

      // Non-empty row: insert new row after at same depth
      const newRow: ListRow = {
        id: generateId(),
        content: '',
        checked: block.type === 'checklist' ? false : undefined,
        depth: row.depth,
      };
      const newRows = [...rows.slice(0, rowIndex + 1), newRow, ...rows.slice(rowIndex + 1)];
      commitRows(newRows, newRow.id);
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        if (row.depth === 0) return;
        const newRows = [...rows];
        newRows[rowIndex] = { ...row, depth: row.depth - 1 };
        commitRows(newRows, row.id);
      } else {
        if (rowIndex === 0) return;
        const maxDepth = rows[rowIndex - 1].depth + 1;
        const newRows = [...rows];
        newRows[rowIndex] = { ...row, depth: Math.min(row.depth + 1, maxDepth) };
        commitRows(newRows, row.id);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (rowIndex < rows.length - 1) {
        focusRow(rows[rowIndex + 1].id);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowIndex > 0) {
        focusRow(rows[rowIndex - 1].id);
      }
      return;
    }

    if (e.key === ' ') {
      const el = rowRefs.current.get(row.id);
      if (!el) return;
      const text = el.textContent ?? '';

      if (text === '#') {
        e.preventDefault();
        onUpdate(block.id, { type: 'text', style: 'title', content: '', children: undefined });
        return;
      }
      if (text === '##') {
        e.preventDefault();
        onUpdate(block.id, { type: 'text', style: 'heading', content: '', children: undefined });
        return;
      }
      if (text === '###') {
        e.preventDefault();
        onUpdate(block.id, { type: 'text', style: 'subheading', content: '', children: undefined });
        return;
      }
      if (text === '[]') {
        e.preventDefault();
        onUpdate(block.id, { type: 'checklist', checked: false, content: '', children: undefined });
        return;
      }
      if (text === '1.') {
        e.preventDefault();
        onUpdate(block.id, { type: 'numberedList', content: '', children: undefined });
        return;
      }
      if (text === '>' || text === '"') {
        e.preventDefault();
        onUpdate(block.id, { type: 'quote', content: '', children: undefined });
        return;
      }
      if (text === '---') {
        e.preventDefault();
        onUpdate(block.id, { type: 'divider', content: '', children: undefined });
        return;
      }
      if (text === '-') {
        e.preventDefault();
        const maxDepth = rowIndex === 0 ? 0 : rows[rowIndex - 1].depth + 1;
        if (row.depth < maxDepth) {
          const newRows = [...rows];
          newRows[rowIndex] = { ...row, content: '', depth: row.depth + 1 };
          commitRows(newRows, row.id);
        }
        return;
      }
    }

    if (e.key === 'Backspace') {
      const el = rowRefs.current.get(row.id);
      const text = el?.textContent ?? '';
      if (!text.trim()) {
        e.preventDefault();
        if (row.depth > 0) {
          const newRows = [...rows];
          newRows[rowIndex] = { ...row, depth: row.depth - 1 };
          commitRows(newRows, row.id);
        } else if (rowIndex === 0 && rows.length === 1) {
          onExitTop();
        } else if (rowIndex === 0) {
          commitRows(rows.slice(1), rows[1].id);
        } else {
          const prevId = rows[rowIndex - 1].id;
          commitRows([...rows.slice(0, rowIndex), ...rows.slice(rowIndex + 1)], prevId);
        }
        return;
      }

      // Non-empty row: check if cursor is at start position
      const sel = window.getSelection();
      if (sel?.rangeCount && sel.getRangeAt(0).collapsed) {
        const range = sel.getRangeAt(0);
        const testRange = document.createRange();
        testRange.selectNodeContents(el!);
        testRange.setEnd(range.startContainer, range.startOffset);
        if (testRange.toString().length === 0) {
          e.preventDefault();
          if (row.depth > 0) {
            const newRows = [...rows];
            newRows[rowIndex] = { ...row, depth: row.depth - 1 };
            commitRows(newRows, row.id);
          } else if (rowIndex > 0) {
            const prevRow = rows[rowIndex - 1];
            const prevContent = prevRow.content || '';
            const curContent = row.content || '';
            const newContent = prevContent + curContent;
            const mergedRows = [...rows.slice(0, rowIndex - 1), { ...prevRow, content: newContent }, ...rows.slice(rowIndex + 1)];
            commitRows(mergedRows, prevRow.id);
          }
          return;
        }
      }
    }
  }, [block.type, block.id, commitRows, onExitBottom, onExitTop, onUpdate, focusRow]);

  const rows = rowsRef.current;

  return (
    <div className="flex flex-col w-full">
      {rows.map((row, i) => (
        <RowEl
          key={row.id}
          row={row}
          rowIndex={i}
          rows={rows}
          blockType={block.type}
          listNumber={listNumber}
          onRowUpdate={handleRowUpdate}
          onKeyDown={handleKeyDown}
          onFocusBlock={() => onFocus?.(block.id)}
          registerRef={registerRef}
          isDraggingGlobal={isDraggingGlobal}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}
