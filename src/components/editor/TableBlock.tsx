"use client";

import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical, Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EditorBlock } from '@/data/store';
import { draggable, dropTargetForElements, monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { attachClosestEdge, type Edge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';

interface TableBlockProps {
  block: EditorBlock;
  onUpdate: (id: string, updates: Partial<EditorBlock>) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isReadOnly?: boolean;
}

function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const newArray = array.slice();
  newArray.splice(to < 0 ? newArray.length + to : to, 0, newArray.splice(from, 1)[0]);
  return newArray;
}

function RowHandle({
  dragHandleRef,
  isSelected,
  onSelect,
  onContextMenu,
}: {
  dragHandleRef: React.RefObject<HTMLDivElement | null>;
  isSelected: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  return (
    <td
      className={cn(
        "w-8 border-b border-[var(--bone-10)] bg-[var(--bone-5)] relative border-r border-[var(--bone-10)]",
        isSelected && "bg-[var(--bone-3)]"
      )}
    >
      <div
        ref={dragHandleRef}
        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/row:opacity-100 cursor-grab active:cursor-grabbing"
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        onContextMenu={onContextMenu}
      >
        <GripVertical strokeWidth={2} className="w-3.5 h-3.5 text-[var(--bone-40)] hover:text-[var(--bone-100)]" />
      </div>
    </td>
  );
}

function TableCell({
  initialValue,
  onUpdate,
  className,
  onClick,
  onContextMenu,
  isHeader = false,
  colCount,
  ri,
  ci,
  onMoveColumn,
  onLinkContextMenu,
  isReadOnly = false,
}: {
  initialValue: string;
  onUpdate: (html: string) => void;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isHeader?: boolean;
  colCount: number;
  ri: number;
  ci: number;
  onMoveColumn?: (ci: number, direction: 'left' | 'right') => void;
  onLinkContextMenu?: (e: React.MouseEvent) => void;
  isReadOnly?: boolean;
}) {
  const editableRef = useRef<HTMLDivElement | HTMLTableCellElement>(null);
  const lastValueRef = useRef(initialValue);

  useEffect(() => {
    if (editableRef.current && document.activeElement !== editableRef.current) {
      editableRef.current.innerHTML = initialValue;
      lastValueRef.current = initialValue;
    }
  }, [initialValue]);

  const handleBlur = () => {
    if (editableRef.current) {
      const html = editableRef.current.innerHTML;
      if (html !== lastValueRef.current) {
        lastValueRef.current = html;
        onUpdate(html);
      }
    }
  };

  if (isHeader) {
    return (
      <td
        className={className}
        onClick={onClick}
        onContextMenu={onContextMenu}
      >
        <div
          ref={editableRef as React.RefObject<HTMLDivElement | null>}
          contentEditable={!isReadOnly ? true : undefined}
          suppressContentEditableWarning
          className="outline-none"
          onBlur={handleBlur}
          onContextMenu={onLinkContextMenu}
        />
        {onMoveColumn && !isReadOnly && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/cell:opacity-100 z-10">
            <button
              onClick={(e) => { e.stopPropagation(); onMoveColumn(ci, 'left'); }}
              className="p-0.5 rounded hover:bg-[var(--bone-5)] text-[var(--bone-40)] hover:text-[var(--bone-100)]"
            >
              <ChevronLeft strokeWidth={2} className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onMoveColumn(ci, 'right'); }}
              className="p-0.5 rounded hover:bg-[var(--bone-5)] text-[var(--bone-40)] hover:text-[var(--bone-100)]"
            >
              <ChevronRight strokeWidth={2} className="w-2.5 h-2.5" />
            </button>
          </div>
        )}
      </td>
    );
  }

  return (
    <td
      ref={editableRef as React.RefObject<HTMLTableCellElement | null>}
      contentEditable={!isReadOnly ? true : undefined}
      suppressContentEditableWarning
      className={className}
      onBlur={handleBlur}
      onContextMenu={onLinkContextMenu}
    />
  );
}

function SortableRow({
  id,
  row,
  ri,
  isSelected,
  selectedCol,
  onSelect,
  onContextMenu,
  onColSelect,
  onColContextMenu,
  onCellUpdate,
  colCount,
  onMoveColumn,
  blockId,
  onLinkContextMenu,
  isReadOnly = false,
}: {
  id: string;
  row: string[];
  ri: number;
  isSelected: boolean;
  selectedCol: number | null;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onColSelect?: (ci: number) => void;
  onColContextMenu?: (e: React.MouseEvent, ci: number) => void;
  onCellUpdate: (ri: number, ci: number, html: string) => void;
  colCount: number;
  onMoveColumn?: (ci: number, direction: 'left' | 'right') => void;
  blockId: string;
  onLinkContextMenu?: (e: React.MouseEvent) => void;
  isReadOnly?: boolean;
}) {
  const elementRef = useRef<HTMLTableRowElement | null>(null);
  const dragHandleRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  useEffect(() => {
    const el = elementRef.current;
    const dragHandle = dragHandleRef.current;
    if (!el || !dragHandle || isReadOnly) return;

    return draggable({
      element: el,
      dragHandle: dragHandle,
      getInitialData: () => ({ type: 'table-row', rowId: id, index: ri, blockId }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    });
  }, [id, ri, blockId, isReadOnly]);

  useEffect(() => {
    const el = elementRef.current;
    if (!el || isReadOnly) return;

    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => source.data.type === 'table-row' && source.data.rowId !== id && source.data.blockId === blockId,
      getData: ({ input, element }) => attachClosestEdge(
        { type: 'table-row', rowId: id, index: ri },
        { input, element, allowedEdges: ['top', 'bottom'] }
      ),
      onDragEnter: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
      onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
      onDragLeave: () => setClosestEdge(null),
      onDrop: () => setClosestEdge(null),
    });
  }, [id, ri, blockId, isReadOnly]);

  return (
    <tr
      ref={elementRef}
      className={cn(
        "group/row relative transition-colors duration-0",
        ri > 0 && "hover:bg-[var(--bone-2)]",
        (isSelected || isDragging) && "bg-[var(--bone-3)]",
        closestEdge === 'top' && "[&>td]:border-t-2 [&>td]:border-t-[var(--bone-35)]",
        closestEdge === 'bottom' && "[&>td]:border-b-2 [&>td]:border-b-[var(--bone-35)]"
      )}
    >
      {!isReadOnly && (
        <RowHandle
          dragHandleRef={dragHandleRef}
          isSelected={isSelected}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
        />
      )}
      {ri === 0 ? (
        row.map((cell: string, ci: number) => (
          <TableCell
            key={ci}
            initialValue={cell}
            onUpdate={(html) => onCellUpdate(ri, ci, html)}
            className={cn(
              "relative px-4 py-2.5 text-[13px] font-sans border-b border-r border-[var(--bone-10)] last:border-r-0 outline-none transition-colors leading-snug group/cell",
              "font-bold text-bone-100 bg-[var(--bone-5)] text-[10.5px] uppercase tracking-wider",
              ci === 0 && "font-semibold",
              ri === colCount - 1 && "border-b-0",
              selectedCol === ci && "!bg-[var(--bone-3)]"
            )}
            onClick={(e) => { e.stopPropagation(); onColSelect?.(ci); }}
            onContextMenu={(e) => onColContextMenu?.(e, ci)}
            isHeader={true}
            colCount={colCount}
            ri={ri}
            ci={ci}
            onMoveColumn={onMoveColumn}
            onLinkContextMenu={onLinkContextMenu}
            isReadOnly={isReadOnly}
          />
        ))
      ) : (
        row.map((cell: string, ci: number) => (
          <TableCell
            key={ci}
            initialValue={cell}
            onUpdate={(html) => onCellUpdate(ri, ci, html)}
            className={cn(
              "px-4 py-2.5 text-[13px] font-sans border-b border-r border-[var(--bone-10)] last:border-r-0 outline-none transition-colors leading-snug",
              "text-bone-100 focus:bg-[var(--bone-2)]",
              ci === 0 && "font-semibold text-bone-100",
              ri === colCount - 1 && "border-b-0",
              selectedCol === ci && "bg-[var(--bone-3)]"
            )}
            onClick={(e) => { e.stopPropagation(); onColSelect?.(ci); }}
            onContextMenu={(e) => onColContextMenu?.(e, ci)}
            isHeader={false}
            colCount={colCount}
            ri={ri}
            ci={ci}
            onLinkContextMenu={onLinkContextMenu}
            isReadOnly={isReadOnly}
          />
        ))
      )}
    </tr>
  );
}

export function TableBlock({ block, onUpdate, onContextMenu, isReadOnly = false }: TableBlockProps) {
  const tableData = block.tableData ?? [['', '', ''], ['', '', ''], ['', '', '']];
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [selectedCol, setSelectedCol] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: 'row' | 'col'; index: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const rowIds = tableData.map((_, ri) => `row-${ri}`);
  const colCount = tableData[0]?.length ?? 0;

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSelectedRow(null);
        setSelectedCol(null);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.isContentEditable) return;
      if ((e.key === 'Delete' || e.key === 'Backspace')) {
        if (selectedRow !== null) {
          e.preventDefault();
          if (tableData.length <= 1) return;
          const newData = tableData.filter((_: any, idx: number) => idx !== selectedRow);
          onUpdate(block.id, { tableData: newData });
          setSelectedRow(null);
        } else if (selectedCol !== null) {
          e.preventDefault();
          if (tableData[0].length <= 1) return;
          const newData = tableData.map((row: string[]) => {
            const newRow = [...row];
            newRow.splice(selectedCol, 1);
            return newRow;
          });
          onUpdate(block.id, { tableData: newData });
          setSelectedCol(null);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedRow, selectedCol, tableData, block.id, onUpdate]);

  const handleCellUpdate = useCallback((ri: number, ci: number, html: string) => {
    const newData = tableData.map((r: string[]) => [...r]);
    newData[ri][ci] = html;
    onUpdate(block.id, { tableData: newData });
  }, [tableData, block.id, onUpdate]);

  const handleRowContextMenu = useCallback((e: React.MouseEvent, ri: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedRow(ri);
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'row', index: ri });
  }, []);

  const handleColContextMenu = useCallback((e: React.MouseEvent, ci: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedCol(ci);
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'col', index: ci });
  }, []);

  const handleDeleteRow = useCallback((ri: number) => {
    if (tableData.length <= 1) return;
    const newData = tableData.filter((_: any, idx: number) => idx !== ri);
    onUpdate(block.id, { tableData: newData });
    setSelectedRow(null);
    setContextMenu(null);
  }, [tableData, block.id, onUpdate]);

  const handleDeleteCol = useCallback((ci: number) => {
    if (tableData[0].length <= 1) return;
    const newData = tableData.map((row: string[]) => {
      const newRow = [...row];
      newRow.splice(ci, 1);
      return newRow;
    });
    onUpdate(block.id, { tableData: newData });
    setSelectedCol(null);
    setContextMenu(null);
  }, [tableData, block.id, onUpdate]);

  const handleMoveColumn = useCallback((ci: number, direction: 'left' | 'right') => {
    const target = direction === 'left' ? ci - 1 : ci + 1;
    if (target < 0 || target >= colCount) return;
    const newData = tableData.map((row: string[]) => {
      const newRow = [...row];
      const [moved] = newRow.splice(ci, 1);
      newRow.splice(target, 0, moved);
      return newRow;
    });
    onUpdate(block.id, { tableData: newData });
    setSelectedCol(target);
  }, [tableData, block.id, colCount, onUpdate]);

  useEffect(() => {
    return monitorForElements({
      canMonitor: ({ source }) => source.data.type === 'table-row' && source.data.blockId === block.id,
      onDrop: ({ source, location }) => {
        const target = location.current.dropTargets[0];
        if (!target) return;

        const sourceIndex = source.data.index as number;
        const targetIndex = target.data.index as number;
        if (sourceIndex === targetIndex) return;

        const edge = extractClosestEdge(target.data);
        if (!edge) return;

        let toIndex = targetIndex;
        if (edge === 'bottom') {
          toIndex += 1;
        }

        if (sourceIndex === toIndex) return;

        const newData = arrayMove(tableData, sourceIndex, toIndex);
        onUpdate(block.id, { tableData: newData });
      }
    });
  }, [tableData, block.id, onUpdate]);

  const rowCount = tableData.length;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="border border-[var(--bone-10)] rounded-3xl overflow-hidden bg-panel">
        <table className="w-full border-collapse">
          <tbody>
            {tableData.map((row: string[], ri: number) => (
              <SortableRow
                key={rowIds[ri]}
                id={rowIds[ri]}
                row={row}
                ri={ri}
                isSelected={selectedRow === ri}
                selectedCol={selectedCol}
                onSelect={() => { setSelectedRow(ri); setSelectedCol(null); }}
                onContextMenu={(e) => handleRowContextMenu(e, ri)}
                onColSelect={(ci) => { setSelectedCol(ci); setSelectedRow(null); }}
                onColContextMenu={handleColContextMenu}
                onCellUpdate={handleCellUpdate}
                colCount={rowCount}
                onMoveColumn={handleMoveColumn}
                blockId={block.id}
                onLinkContextMenu={onContextMenu}
                isReadOnly={isReadOnly}
              />
            ))}
          </tbody>
        </table>
      </div>

      {!isReadOnly && (
        <>
          <button
            onClick={() => {
              const cols = tableData[0]?.length ?? 3;
              onUpdate(block.id, { tableData: [...tableData, Array(cols).fill('')] });
            }}
            className="h-6 w-full opacity-0 group-hover/table:opacity-100 flex items-center justify-center text-[9px] font-bold text-muted-foreground/30 hover:text-foreground hover:bg-white/5 rounded-b-[var(--radius-medium)] transition-all mt-0.5 uppercase tracking-widest"
          >
            + Add Row
          </button>

          <button
            onClick={() => onUpdate(block.id, { tableData: tableData.map((row: string[]) => [...row, '']) })}
            className="absolute top-0 bottom-0 right-[-1.5rem] w-5 opacity-0 group-hover/table:opacity-100 flex flex-col items-center justify-center text-[9px] font-bold text-muted-foreground/30 hover:text-foreground hover:bg-white/5 rounded-r-[var(--radius-medium)] transition-all [writing-mode:vertical-rl] uppercase tracking-widest"
          >
            + Add Column
          </button>
        </>
      )}

      {!isReadOnly && contextMenu && typeof document !== 'undefined' && createPortal(
        <div
          ref={contextMenuRef}
          className="fixed popup-glass-small z-[9999] min-w-[140px] p-1.5 flex flex-col gap-[3px] shadow-2xl"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              if (contextMenu.type === 'row') handleDeleteRow(contextMenu.index);
              else handleDeleteCol(contextMenu.index);
            }}
            className="popup-item-danger gap-2"
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span>Delete {contextMenu.type === 'row' ? 'row' : 'column'}</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
