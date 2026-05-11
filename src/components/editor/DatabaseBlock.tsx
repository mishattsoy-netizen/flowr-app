"use client";

import { useCallback } from 'react';
import { Plus, Table, Kanban, GalleryHorizontalEnd, ListFilter, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { EditorBlock, DatabaseColumn, DatabaseRow, DatabaseViewType } from '@/data/store';
import { generateId } from '@/data/store';

interface DatabaseBlockProps {
  block: EditorBlock;
  onUpdate: (id: string, updates: Partial<EditorBlock>) => void;
}

const VIEW_TABS: { type: DatabaseViewType; icon: React.ReactNode; label: string }[] = [
  { type: 'table', icon: <Table strokeWidth={2} className="w-3.5 h-3.5" />, label: 'Table' },
  { type: 'board', icon: <Kanban strokeWidth={2} className="w-3.5 h-3.5" />, label: 'Board' },
  { type: 'gallery', icon: <GalleryHorizontalEnd strokeWidth={2} className="w-3.5 h-3.5" />, label: 'Gallery' },
  { type: 'list', icon: <ListFilter strokeWidth={2} className="w-3.5 h-3.5" />, label: 'List' },
];

const DEFAULT_COLUMNS: DatabaseColumn[] = [
  { id: 'col-name', name: 'Name', type: 'text' },
  { id: 'col-status', name: 'Status', type: 'select', options: ['To Do', 'In Progress', 'Done'] },
  { id: 'col-date', name: 'Date', type: 'date' },
];

const DEFAULT_ROWS: DatabaseRow[] = [
  { id: 'row-1', cells: { 'col-name': 'Item 1', 'col-status': 'To Do', 'col-date': '' } },
  { id: 'row-2', cells: { 'col-name': 'Item 2', 'col-status': 'In Progress', 'col-date': '' } },
  { id: 'row-3', cells: { 'col-name': 'Item 3', 'col-status': 'Done', 'col-date': '' } },
];

export function DatabaseBlock({ block, onUpdate }: DatabaseBlockProps) {
  const viewType = block.dbViewType ?? 'table';
  const columns = block.dbColumns ?? DEFAULT_COLUMNS;
  const rows = block.dbRows ?? DEFAULT_ROWS;
  const groupCol = block.dbGroupByColumnId ?? columns.find(c => c.type === 'select')?.id;

  const updateDb = useCallback((updates: Partial<EditorBlock>) => {
    onUpdate(block.id, {
      dbColumns: columns,
      dbRows: rows,
      ...updates,
    });
  }, [block.id, columns, rows, onUpdate]);

  const addRow = () => {
    const newRow: DatabaseRow = {
      id: generateId(),
      cells: Object.fromEntries(columns.map(c => [c.id, ''])),
    };
    updateDb({ dbRows: [...rows, newRow] });
  };

  const addColumn = () => {
    const id = generateId();
    const newCol: DatabaseColumn = { id, name: 'New Column', type: 'text' };
    updateDb({
      dbColumns: [...columns, newCol],
      dbRows: rows.map(r => ({ ...r, cells: { ...r.cells, [id]: '' } })),
    });
  };

  const deleteRow = (rowId: string) => {
    updateDb({ dbRows: rows.filter(r => r.id !== rowId) });
  };

  const updateCell = (rowId: string, colId: string, value: string) => {
    updateDb({
      dbRows: rows.map(r =>
        r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r
      ),
    });
  };

  const setViewType = (vt: DatabaseViewType) => {
    updateDb({ dbViewType: vt });
  };

  // ─── Table View ──────────────────────────────────────
  const renderTableView = () => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.id} className="db-header-cell text-left">{col.name}</th>
            ))}
            <th className="db-header-cell w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="group/row hover:bg-hover/30 ">
              {columns.map(col => (
                <td key={col.id} className="db-cell">
                  {col.type === 'select' ? (
                    <select
                      value={row.cells[col.id] ?? ''}
                      onChange={e => updateCell(row.id, col.id, e.target.value)}
                      className="bg-transparent outline-none text-foreground text-sm w-full cursor-pointer"
                    >
                      <option value="">—</option>
                      {col.options?.map((opt, idx) => (
                        <option key={`${opt}-${idx}`} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : col.type === 'checkbox' ? (
                    <input
                      type="checkbox"
                      checked={row.cells[col.id] === 'true'}
                      onChange={e => updateCell(row.id, col.id, String(e.target.checked))}
                      className="accent-accent"
                    />
                  ) : col.type === 'date' ? (
                    <input
                      type="date"
                      value={row.cells[col.id] ?? ''}
                      onChange={e => updateCell(row.id, col.id, e.target.value)}
                      className="bg-transparent outline-none text-foreground text-sm w-full"
                    />
                  ) : (
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      className="outline-none text-sm text-foreground"
                      onBlur={e => updateCell(row.id, col.id, (e.target as HTMLElement).textContent ?? '')}
                    >
                      {row.cells[col.id] ?? ''}
                    </div>
                  )}
                </td>
              ))}
              <td className="db-cell !border-r-0">
                <button
                  onClick={() => deleteRow(row.id)}
                  className="opacity-0 group-hover/row:opacity-100 p-1 rounded-md hover:bg-hover text-muted-foreground hover:text-red-400 "
                >
                  <Trash2 strokeWidth={2} className="w-3 h-3" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex border-t border-border/50">
        <button onClick={addRow} className="flex-1 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-hover ">
          <Plus strokeWidth={2} className="w-3 h-3" /> Row
        </button>
        <button onClick={addColumn} className="flex-1 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-hover ">
          <Plus strokeWidth={2} className="w-3 h-3" /> Column
        </button>
      </div>
    </div>
  );

  // ─── Board View ──────────────────────────────────────
  const renderBoardView = () => {
    const groupColumn = columns.find(c => c.id === groupCol);
    const groups = groupColumn?.options ?? ['Ungrouped'];

    return (
      <div className="flex gap-4 overflow-x-auto p-3">
        {groups.map(group => {
          const groupRows = rows.filter(r => r.cells[groupCol ?? ''] === group);
          return (
            <div key={group} className="min-w-[220px] flex-shrink-0">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                {group} <span className="text-muted-foreground/50 ml-1">{groupRows.length}</span>
              </div>
              <div className="space-y-2">
                {groupRows.map(row => (
                  <div key={row.id} className="bg-background border border-border/50 rounded-xl p-3 hover:border-border ">
                    <p className="text-sm font-medium text-foreground mb-1">{row.cells[columns[0]?.id] ?? 'Untitled'}</p>
                    {columns.slice(2).map(col => {
                      const val = row.cells[col.id];
                      if (!val) return null;
                      return (
                        <p key={col.id} className="text-xs text-muted-foreground">
                          {col.name}: {val}
                        </p>
                      );
                    })}
                  </div>
                ))}
                <button
                  onClick={() => {
                    const newRow: DatabaseRow = {
                      id: generateId(),
                      cells: {
                        ...Object.fromEntries(columns.map(c => [c.id, ''])),
                        [groupCol ?? '']: group,
                      },
                    };
                    updateDb({ dbRows: [...rows, newRow] });
                  }}
                  className="w-full py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-hover rounded-xl "
                >
                  <Plus strokeWidth={2} className="w-3 h-3" /> Add
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── Gallery View ────────────────────────────────────
  const renderGalleryView = () => (
    <div className="grid grid-cols-3 gap-3 p-3">
      {rows.map(row => (
        <div key={row.id} className="bg-background border border-border/50 rounded-2xl p-4 hover:border-border ">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent font-bold mb-3">
            {(row.cells[columns[0]?.id] ?? '?').charAt(0)}
          </div>
          <p className="text-sm font-medium text-foreground mb-1">{row.cells[columns[0]?.id] ?? 'Untitled'}</p>
          {columns.slice(1, 3).map(col => {
            const val = row.cells[col.id];
            if (!val) return null;
            return (
              <p key={col.id} className="text-xs text-muted-foreground truncate">
                {val}
              </p>
            );
          })}
        </div>
      ))}
      <button
        className="bg-background border border-dashed border-border/50 rounded-2xl p-4 hover:border-border "
      >
        <Plus strokeWidth={2} className="w-5 h-5" />
      </button>
    </div>
  );

  // ─── List View ───────────────────────────────────────
  const renderListView = () => (
    <div className="flex flex-col">
      {rows.map((row, idx) => (
        <div
          key={row.id}
          className={clsx(
            "group/row flex items-center justify-between px-4 py-3 border border-border/50 hover:bg-hover ",
            idx === 0 && "rounded-t-[1.25rem]",
            idx === rows.length - 1 ? "rounded-b-[1.25rem]" : "border-b-0"
          )}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center text-accent text-xs font-bold shrink-0">
              {(row.cells[columns[0]?.id] ?? '?').charAt(0)}
            </div>
            <span className="text-sm font-medium text-foreground truncate">
              {row.cells[columns[0]?.id] ?? 'Untitled'}
            </span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {columns.slice(1, 3).map(col => {
              const val = row.cells[col.id];
              if (!val) return null;
              return (
                <span key={col.id} className="text-xs text-muted-foreground">{val}</span>
              );
            })}
            <button
              onClick={() => deleteRow(row.id)}
              className="opacity-0 group-hover/row:opacity-100 p-1 rounded-md hover:bg-hover text-muted-foreground hover:text-red-400 "
            >
              <Trash2 strokeWidth={2} className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
      <button
        onClick={addRow}
        className="px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-hover "
      >
        <Plus strokeWidth={2} className="w-3 h-3" /> New Row
      </button>
    </div>
  );

  return (
    <div className="bg-sidebar border border-border/50 rounded-3xl overflow-hidden">
      {/* Header with view tabs */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <span className="text-sm font-semibold text-foreground">Database</span>
        <div className="relative flex items-center p-0.5 bg-background rounded-[8px] border border-border/50 no-drag min-w-[280px]">
          {/* Sliding Background Pill */}
          <div 
            className="absolute top-[3px] bottom-[3px] rounded-[6px] bg-[var(--bone-10)] transition-all duration-300 ease-out"
            style={{ 
              left: `calc(${VIEW_TABS.findIndex(t => t.type === viewType) * 25}% + ${VIEW_TABS.findIndex(t => t.type === viewType) === 0 ? '3px' : '1px'})`,
              width: 'calc(25% - 4px)'
            }}
          />
          
          {VIEW_TABS.map(tab => {
            const isActive = viewType === tab.type;
            return (
              <button
                key={tab.type}
                onClick={() => setViewType(tab.type)}
                className={clsx(
                  "relative z-10 flex-1 flex items-center justify-center gap-1.5 py-1 rounded-[6px] transition-colors duration-200",
                  isActive ? "text-[var(--bone-100)]" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.icon}
                <span className="text-[11px] font-semibold">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* View Content */}
      {viewType === 'table' && renderTableView()}
      {viewType === 'board' && renderBoardView()}
      {viewType === 'gallery' && renderGalleryView()}
      {viewType === 'list' && renderListView()}
    </div>
  );
}

