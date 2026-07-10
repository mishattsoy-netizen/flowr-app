"use client";

import { useStore } from '@/data/store';
import { Plus, X, ExternalLink, File, FileText, Layout, Edit2, Trash2, Link2, Check, ChevronDown, Folder, Frame, ChevronRight } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getEntityIcon } from '@/data/icons';
import { cn } from '@/lib/utils';
import type { WidgetProps } from './types';

interface Shortcut {
  id: string;
  type: 'url' | 'entity';
  label: string;
  value: string; // URL or Entity ID
  icon?: string;
}

const EMPTY_SHORTCUTS: Shortcut[] = [];

export function ShortcutsWidget({ contextId }: { contextId: string }) {
  const activeSpaceId = useStore(state => state.activeSpaceId);
  const scopedKey = activeSpaceId ? `${activeSpaceId}:${contextId}` : contextId;
  // scopedKey = `${activeSpaceId}:${contextId}` — ensures isolation per space
  const shortcuts = useStore(state => state.shortcuts[scopedKey] || EMPTY_SHORTCUTS);
  const entities = useStore(state => state.entities);
  const setActiveEntityId = useStore(state => state.setActiveEntityId);
  const setShortcuts = useStore(state => state.setShortcuts);
  const addShortcut = useStore(state => state.addShortcut);
  const removeShortcut = useStore(state => state.removeShortcut);

  // Grid layout adjusts cols dynamically. Each shortcut spans exactly 1 row
  // in a 3-row layout, occupying 1/3 of the widget height.
  const numCols = shortcuts.length > 9 ? 4 : shortcuts.length > 6 ? 3 : 2;
  const rowSpan = 1;

  const totalSlots = numCols * 3;
  const placeholdersCount = Math.max(0, totalSlots - shortcuts.length);
  const placeholders = Array.from({ length: placeholdersCount });

  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');
  const [type, setType] = useState<'url' | 'entity'>('url');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPageDropdown, setShowPageDropdown] = useState(false);
  const [entitySearch, setEntitySearch] = useState('');
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const selectBtnRef = useRef<HTMLButtonElement>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Position the portal dropdown below the trigger button when it opens
  useEffect(() => {
    if (showPageDropdown && selectBtnRef.current) {
      const rect = selectBtnRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${rect.bottom + 4}px`,
        width: `${rect.width}px`,
      });
    } else {
      setDropdownStyle({});
    }
  }, [showPageDropdown]);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [justDropped, setJustDropped] = useState<{ id: string; nonce: number } | null>(null);

  const handleDragStart = (idx: number) => { setDragIdx(idx); };
  const handleDragEnter = (idx: number) => { setDragOverIdx(idx); };
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };
  const handleDrop = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) { handleDragEnd(); return; }
    const reordered = [...shortcuts];
    [reordered[dragIdx], reordered[targetIdx]] = [reordered[targetIdx], reordered[dragIdx]];
    const droppedId = shortcuts[dragIdx].id;
    setShortcuts(scopedKey, reordered);
    setJustDropped({ id: droppedId, nonce: Date.now() });
    handleDragEnd();
    setTimeout(() => setJustDropped(null), 800);
  };

  const handleAdd = () => {
    if (!newValue.trim()) return;
    const label = newLabel.trim() || (type === 'entity' ? entities.find(e => e.id === newValue)?.title : 'Link') || 'Link';

    if (editingId) {
      const updated = shortcuts.map(s => s.id === editingId ? { ...s, type, label, value: newValue.trim() } : s);
      setShortcuts(scopedKey, updated);
    } else {
      addShortcut(scopedKey, label, newValue.trim(), type);
    }

    setNewLabel('');
    setNewValue('');
    setIsAdding(false);
    setEditingId(null);
    setShowPageDropdown(false);
  };

  const handleRemove = (id: string) => {
    removeShortcut(scopedKey, id);
  };

  return (
    <section className="bg-panel group/widget px-5 pb-5 pt-4 widget-shadow h-full flex flex-col relative">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-widget-header font-semibold text-muted-foreground">
          Shortcuts
        </h2>
        {shortcuts.length < 12 && (
          <button
            onClick={() => setIsAdding(true)}
            className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-100)] opacity-30 hover:opacity-100 hover:bg-[var(--app-dark)] transition-all duration-200 ease-in-out"
          >
            <Plus strokeWidth={2} className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col no-scrollbar relative">
        {shortcuts.length > 0 ? (
          <div
            className={cn(
              "grid gap-2 flex-1 grid-flow-row transition-opacity duration-200",
              isAdding && "opacity-20 pointer-events-none"
            )}
            style={{
              gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))`,
              gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
              gridAutoRows: 'minmax(0, 1fr)',
            }}
          >
            {shortcuts.map((s, i) => (
              <ShortcutItem
                key={s.id}
                rowSpan={rowSpan}
                shortcut={s}
                entities={entities}
                onSelectEntity={setActiveEntityId}
                onRemove={handleRemove}
                onEdit={(shortcutToEdit) => {
                  setEditingId(shortcutToEdit.id);
                  setNewLabel(shortcutToEdit.label);
                  setNewValue(shortcutToEdit.value);
                  setType(shortcutToEdit.type);
                  setIsAdding(true);
                }}
                isDragging={dragIdx === i}
                isDragOver={dragOverIdx === i && dragIdx !== i}
                dropNonce={justDropped?.id === s.id ? justDropped.nonce : 0}
                dragProps={{
                  draggable: true,
                  onDragStart: () => handleDragStart(i),
                  onDragEnter: (e: any) => { e.preventDefault(); handleDragEnter(i); },
                  onDragOver: (e: any) => e.preventDefault(),
                  onDrop: () => handleDrop(i),
                  onDragEnd: handleDragEnd,
                }}
              />
            ))}
            {placeholders.map((_, idx) => (
              <button
                key={`placeholder-${idx}`}
                onClick={() => setIsAdding(true)}
                className="w-full h-full min-h-[76px] flex items-center justify-center p-3 rounded-[10px] border border-dashed border-[var(--bone-10)] bg-transparent opacity-[0.08] hover:opacity-25 hover:bg-[var(--bone-5)] hover:border-[var(--bone-20)] transition-all duration-200 cursor-pointer"
              >
                <Plus strokeWidth={1.5} className="w-4 h-4 text-[var(--bone-100)]" />
              </button>
            ))}
          </div>
        ) : (
          <div className={cn(
            "h-full flex flex-col items-center justify-center gap-3 p-4 bg-white/[0.01] rounded-[12px] min-h-[140px] transition-opacity duration-200",
            isAdding && "opacity-20 pointer-events-none"
          )}>
            <div className="text-center max-w-[320px]">
              <p className="text-base font-semibold text-bone-100 opacity-40">Get started with Shortcuts</p>
              <p className="text-xs text-bone-70 opacity-25 mt-1 leading-snug text-balance">Add quick links to your favorite apps, sites, and documents.</p>
            </div>
            <button
              onClick={() => setIsAdding(true)}
              className="mt-2 flex items-center gap-1 px-3.5 py-2 rounded-[8px] bg-[var(--bone-5)] text-[var(--bone-70)] hover:bg-[var(--bone-10)] hover:text-[var(--bone-100)] text-xs font-medium cursor-pointer transition-all duration-200 ease-in-out"
            >
              <Plus strokeWidth={2} className="w-3.5 h-3.5" /> Add Shortcut
            </button>
          </div>
        )}

      </div>

      {isAdding && (
        <div className="absolute inset-0 bg-transparent flex items-center justify-center p-5 z-40 transition-all duration-200 ease-in-out">
          <div className="w-full max-w-[280px] space-y-2 p-2.5 bg-[var(--card-bg)] rounded-xl border border-[var(--bone-10)] relative shadow-2xl">
            <div className="flex p-[3px] rounded-[8px]" style={{ background: 'var(--slider-track)' }}>
              <button
                type="button"
                onClick={() => { setType('url'); setNewValue(''); }}
                className={cn(
                  "flex-1 px-3.5 py-1 text-[11px] font-semibold rounded-[6px] transition-all duration-200 outline-none focus:outline-none cursor-pointer",
                  type === 'url'
                    ? "bg-[var(--slider-pill)] text-[var(--bone-100)] shadow-[var(--slider-pill-shadow)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                URL
              </button>
              <button
                type="button"
                onClick={() => { setType('entity'); setNewValue(''); }}
                className={cn(
                  "flex-1 px-3.5 py-1 text-[11px] font-semibold rounded-[6px] transition-all duration-200 outline-none focus:outline-none cursor-pointer",
                  type === 'entity'
                    ? "bg-[var(--slider-pill)] text-[var(--bone-100)] shadow-[var(--slider-pill-shadow)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Entity
              </button>
            </div>

            {type === 'entity' ? (
              <div className="relative">
                <button
                  type="button"
                  ref={selectBtnRef}
                  onClick={() => setShowPageDropdown(p => !p)}
                  className="w-full flex items-center justify-between bg-[var(--slider-track)] border border-[var(--bone-6)] rounded-[8px] px-2.5 py-1.5 text-[11px] text-left text-[var(--bone-100)] outline-none focus:outline-none focus:border-[var(--bone-30)] transition-all duration-200"
                >
                  <span className={cn(!newValue && "text-[var(--bone-30)]")}>
                    {newValue ? (entities.find(e => e.id === newValue)?.title || 'Select Page...') : 'Select Page...'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
                </button>
                {showPageDropdown && (
                  <>
                    <div className="fixed inset-0 z-[199]" onClick={() => { setShowPageDropdown(false); setEntitySearch(''); }} />
                    {createPortal(
                      <div className="z-[200] popup-glass-small flex flex-col" style={dropdownStyle}>
                        <div className="p-1.5 border-b border-[var(--bone-6)]">
                          <input
                            autoFocus
                            placeholder="Search pages..."
                            value={entitySearch}
                            onChange={e => setEntitySearch(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            className="w-full bg-[var(--card-bg)] border border-[var(--bone-10)] rounded-[8px] px-2.5 py-1.5 text-[11px] text-[var(--bone-100)] placeholder-[var(--bone-30)] outline-none focus:outline-none focus:border-[var(--bone-30)] transition-all duration-200"
                          />
                        </div>
                        <div className="max-h-[200px] overflow-y-auto p-1 flex flex-col gap-[2px]">
                          {entities
                            .filter(e => (e.type === 'note' || e.type === 'canvas') && e.title?.toLowerCase().includes(entitySearch.toLowerCase()))
                            .map(e => {
                              const Icon = e.icon ? getEntityIcon(e.icon) : (() => {
                                if (e.type === 'note') return FileText;
                                if (e.type === 'canvas') return Frame;
                                return Folder;
                              })();
                              return (
                                <button
                                  key={e.id}
                                  type="button"
                                  onClick={() => { setNewValue(e.id); setShowPageDropdown(false); setEntitySearch(''); }}
                                  className="popup-item flex items-center justify-between text-left w-full outline-none focus:outline-none"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <Icon className="w-4 h-4 opacity-70 shrink-0 text-current" />
                                    <span className="truncate flex-1">{e.title}</span>
                                  </div>
                                  {newValue === e.id && (
                                    <Check className="w-3.5 h-3.5 shrink-0 opacity-70" />
                                  )}
                                </button>
                              );
                            })}
                          {entities.filter(e => (e.type === 'note' || e.type === 'canvas') && e.title?.toLowerCase().includes(entitySearch.toLowerCase())).length === 0 && (
                            <p className="text-[11px] text-[var(--bone-30)] text-center py-3">No pages found</p>
                          )}
                        </div>
                      </div>,
                      document.body
                    )}
                  </>
                )}
              </div>
            ) : (
              <input
                placeholder="https://..."
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                className="w-full bg-[var(--slider-track)] border border-[var(--bone-6)] rounded-[8px] px-2.5 py-1.5 text-[11px] text-[var(--bone-100)] placeholder-[var(--bone-30)] outline-none focus:outline-none focus:border-[var(--bone-30)] transition-all duration-200"
              />
            )}

            <input
              placeholder="Label (optional)"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              className="w-full bg-[var(--slider-track)] border border-[var(--bone-6)] rounded-[8px] px-2.5 py-1.5 text-[11px] text-[var(--bone-100)] placeholder-[var(--bone-30)] outline-none focus:outline-none focus:border-[var(--bone-30)] transition-all duration-200"
            />

            <div className="flex gap-2 justify-end pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                  setNewLabel('');
                  setNewValue('');
                  setShowPageDropdown(false);
                }}
                className="px-2.5 py-1 text-[11px] font-semibold text-[var(--bone-60)] hover:text-[var(--bone-100)] transition-colors cursor-pointer outline-none focus:outline-none"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newValue.trim()}
                onClick={handleAdd}
                className="h-6 text-[10px] px-4 font-semibold rounded-[var(--radius-small)] bg-[var(--bone-100)] text-[var(--app-background)] enabled:hover:bg-[var(--app-dark)] enabled:hover:text-[var(--bone-100)] transition-colors duration-200 outline-none focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1"
              >
                {!editingId && <Plus strokeWidth={2.5} className="w-3 h-3" />}
                {editingId ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

interface ShortcutItemProps {
  shortcut: Shortcut;
  entities: any[];
  rowSpan: number;
  onSelectEntity: (id: string) => void;
  onRemove: (id: string) => void;
  onEdit: (s: Shortcut) => void;
  isDragging: boolean;
  isDragOver: boolean;
  dropNonce: number;
  dragProps: any;
}

function ShortcutItem({ shortcut, entities, rowSpan, onSelectEntity, onRemove, onEdit, isDragging, isDragOver, dropNonce, dragProps }: ShortcutItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!showMenu) return;
    const close = () => setShowMenu(false);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    };
  }, [showMenu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    let x = e.clientX;
    let y = e.clientY;
    if (x + 110 > window.innerWidth) {
      x = window.innerWidth - 120;
    }
    if (y + 80 > window.innerHeight) {
      y = window.innerHeight - 90;
    }
    setMenuPos({ x, y });
    setShowMenu(true);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shortcut.value).then(() => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setShowMenu(false);
      }, 800);
    });
  };

  let Icon = ExternalLink;
  let isInternal = shortcut.type === 'entity';
  let faviconUrl = '';
  let displaySubtitle = '';

  if (isInternal) {
    const ent = entities.find(e => e.id === shortcut.value);
    if (ent) {
      if (ent.icon) {
        Icon = getEntityIcon(ent.icon);
      } else if (ent.type === 'note') {
        Icon = File;
      } else if (ent.type === 'canvas') {
        Icon = Frame;
      } else {
        Icon = File;
      }
    } else {
      Icon = File;
    }
    displaySubtitle = 'Document';
  } else {
    try {
      const urlObj = new URL(shortcut.value);
      const hostname = urlObj.hostname;
      faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`;
      displaySubtitle = hostname.replace('www.', '');
    } catch (e) {
      displaySubtitle = shortcut.value;
    }
  }


  const handleDragStartWithImage = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    const clone = target.cloneNode(true) as HTMLElement;
    const rect = target.getBoundingClientRect();
    clone.style.cssText = [
      `width:${rect.width}px`,
      `height:${rect.height}px`,
      'position:fixed',
      'top:-9999px',
      'left:-9999px',
      'border-radius:10px',
      'overflow:hidden',
      'pointer-events:none',
    ].join(';');
    document.body.appendChild(clone);
    e.dataTransfer.setDragImage(clone, rect.width / 2, rect.height / 2);
    requestAnimationFrame(() => document.body.removeChild(clone));
    dragProps.onDragStart?.(e);
  };

  return (
    <div
      className="relative group/shortcut h-full rounded-[10px] overflow-hidden cursor-grab"
      style={{ gridRow: `span ${rowSpan}` }}
      {...dragProps}
      onDragStart={handleDragStartWithImage}
    >
      {isDragging ? (
        <div className="w-full h-full rounded-[10px] border border-dashed border-[var(--bone-10)] bg-transparent opacity-[0.08]" />
      ) : (
        <button
          key={dropNonce > 0 ? `drop-${dropNonce}` : shortcut.id}
          onClick={() => {
            if (isInternal) {
              onSelectEntity(shortcut.value);
            } else {
              window.open(shortcut.value, '_blank');
            }
          }}
          onContextMenu={handleContextMenu}
          className={cn(
            "w-full h-full flex flex-col items-start p-3 rounded-[10px] border text-left cursor-[inherit] group/item transition-colors duration-200 ease-in-out relative",
            isDragOver
              ? "bg-[var(--app-dark)] border-[var(--bone-30)]"
              : "bg-[var(--card-bg)] border-[var(--bone-10)] hover:bg-[var(--app-dark)]",
            dropNonce > 0 && "shortcut-drop-settle"
          )}
        >
          <div className="absolute top-3 right-3 text-[var(--bone-30)] opacity-0 group-hover/item:opacity-100 transition-opacity duration-200 ease-in-out">
          {isInternal ? (
            <ChevronRight strokeWidth={2} className="w-3.5 h-3.5" />
          ) : (
            <ExternalLink strokeWidth={2} className="w-3.5 h-3.5" />
          )}
        </div>

        <div className="opacity-40 group-hover/item:opacity-100 transition-opacity duration-200 ease-in-out text-[var(--bone-100)]">
          {!isInternal && faviconUrl && !imgError ? (
            <img
              src={faviconUrl}
              alt=""
              className="w-5 h-5 object-contain rounded-sm"
              onError={() => setImgError(true)}
            />
          ) : (
            <Icon strokeWidth={2} className="w-5 h-5" />
          )}
        </div>

        <div className="min-w-0 w-full mt-2">
          <div className="text-[12.5px] font-semibold leading-tight truncate text-[var(--bone-100)]">
            {shortcut.label}
          </div>
          <div className="text-[10px] text-[var(--bone-30)] truncate mt-0.5">
            {displaySubtitle}
          </div>
        </div>
      </button>
    )}

      {showMenu && createPortal(
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed z-[500] popup-glass-small p-1 flex flex-col gap-[3px] pointer-events-auto min-w-[100px]"
          style={{
            left: `${menuPos.x}px`,
            top: `${menuPos.y}px`
          }}
        >
          {!isInternal && (
            <button
              onClick={(e) => { e.stopPropagation(); handleCopyLink(); }}
              className="popup-item"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy link'}</span>
            </button>
          )}
          <button
            onClick={() => { onEdit(shortcut); setShowMenu(false); }}
            className="popup-item"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
          <button
            onClick={() => { onRemove(shortcut.id); setShowMenu(false); }}
            className="popup-item-danger"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
