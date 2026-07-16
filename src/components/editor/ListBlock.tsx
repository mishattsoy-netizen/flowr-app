"use client";

import React, { useRef, useCallback, useEffect } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EditorBlock, BlockType } from '@/data/store';
import { formatCounter } from '@/lib/editor/markdownBlocks';

export interface ListRow {
  id: string;
  content: string;
  checked?: boolean;
  depth: number;
}

/**
 * NOTE: row[0] of the returned array is always the list BLOCK itself
 * (id === block.id), not a child item — verified against the real render:
 * ListBlock renders rows.map((row, i) => <RowEl rowIndex={i} .../>) for
 * EVERY entry including index 0, so the block's own content is rendered as
 * an ordinary row. Consumers (see src/lib/editor/listRowOps.ts) rely on
 * this exact convention.
 */
export function flattenRows(block: EditorBlock): ListRow[] {
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

export function nestRows(rows: ListRow[], blockType: BlockType): { content: string; checked?: boolean; children: EditorBlock[] } {
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
  isReadOnly?: boolean;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

// Rows are PASSIVE under the single-editing-host architecture: the NoteEditor
// blocks container is the only contentEditable, and all keyboard/input logic
// lives in its handleHostKeyDown/handleHostInput. A row div only:
//   1. marks itself with data-row-id for those host-level handlers,
//   2. imperatively syncs innerHTML from the store (it has no React children),
//   3. renders non-editable chrome (bullet/number/checkbox) beside the text.
// Do NOT add contentEditable, onKeyDown, onInput, or focus state here — that
// recreates the nested-editing-host dual-handling bug this file used to have.
function RowEl({
  row,
  rowIndex,
  rows,
  blockType,
  listNumber,
  onToggleCheck,
  isDraggingGlobal = false,
  isReadOnly = false,
  onMouseMove,
  onMouseLeave,
  onContextMenu,
}: {
  row: ListRow;
  rowIndex: number;
  rows: ListRow[];
  blockType: BlockType;
  listNumber?: number;
  onToggleCheck: (rowId: string) => void;
  isDraggingGlobal?: boolean;
  isReadOnly?: boolean;
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
      return <span className="text-bone-70/40 text-[16px] font-normal leading-[1.6]" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}>{formatCounter(count, counterStyle)}.</span>;
    }
    return null;
  };

  return (
    <div className="flex items-start w-full py-0.5" style={{ paddingLeft: `${row.depth * 24}px` }}>
      <div
        // Chrome island: NOT part of the editable text. Without this the
        // caret can be placed in front of the checkbox/bullet (user bug #2)
        // and browser-default edits can chew the marker column.
        contentEditable={false}
        className="shrink-0 flex items-start justify-center mr-2.5 h-[1.7em] select-none"
        style={{
          width: '16px',
          paddingTop: blockType === 'checklist' ? '5px' : (blockType === 'numberedList' ? '0px' : '11px')
        }}
      >
        {blockType === 'checklist' ? (
          <div className={cn(
            "w-[16px] h-[16px] shrink-0 rounded-[4px] border flex items-center justify-center cursor-pointer border-[var(--bone-30)] hover:border-[var(--bone-70)] bg-[var(--app-dark)]",
            (isDraggingGlobal || isReadOnly) && "pointer-events-none opacity-50 cursor-default"
          )}
            onClick={(isDraggingGlobal || isReadOnly) ? undefined : () => onToggleCheck(row.id)}
          >
            {row.checked && <Check className="w-[10px] h-[10px] text-[var(--bone-100)]" strokeWidth={3} />}
          </div>
        ) : (
          marker()
        )}
      </div>
      <div
        ref={elRef}
        // Marks the row's editable text for NoteEditor's host-level handlers:
        // they resolve [data-row-id] BEFORE [data-block-id], since a row is
        // nested inside its list's block wrapper.
        data-row-id={row.id}
        suppressContentEditableWarning
        className={cn(
          "flex-1 outline-none min-h-[1.5em] leading-[1.6] text-[16px] font-normal font-display tracking-[-0.02em]",
          row.checked ? "text-[var(--bone-30)]" : "text-bone-100",
        )}
        style={{
          fontFamily: 'var(--font-display)',
          letterSpacing: '-0.01em',
          direction: 'ltr',
          ...(row.checked ? { textDecoration: 'line-through', textDecorationThickness: '1px', textDecorationColor: 'var(--bone-70)' } : {}),
        }}
        dir="ltr"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onContextMenu={onContextMenu}
      />
    </div>
  );
}

export function ListBlock({ block, listNumber, onUpdate, onExitBottom, onExitTop, onFocus, isDraggingGlobal = false, isReadOnly = false, onMouseMove, onMouseLeave, onContextMenu }: ListBlockProps) {
  const rows = flattenRows(block);

  const handleToggleCheck = useCallback((rowId: string) => {
    const current = flattenRows(block);
    const newRows = current.map(r => r.id === rowId ? { ...r, checked: !r.checked } : r);
    const nested = nestRows(newRows, block.type);
    onUpdate(block.id, { content: nested.content, checked: nested.checked, children: nested.children });
  }, [block, onUpdate]);

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
          onToggleCheck={handleToggleCheck}
          isDraggingGlobal={isDraggingGlobal}
          isReadOnly={isReadOnly}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}
