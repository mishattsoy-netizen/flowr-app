"use client";

import { useStore } from '@/data/store';
import { Plus, X, ExternalLink, FileText, Layout, Edit2, Trash2, Link2, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
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

export function ShortcutsWidget({ data, onUpdateData }: Omit<WidgetProps, 'data'> & { data?: { shortcuts?: Shortcut[] }; onUpdateData: (newData: any) => void }) {
  const shortcuts = data?.shortcuts || [];
  const entities = useStore(state => state.entities);
  const setActiveEntityId = useStore(state => state.setActiveEntityId);

  // Grid is always 2 columns minimum, 4 rows tall. Each shortcut occupies a
  // half-column block (1 col x 2 rows), so 4 shortcuts fill the widget. When
  // more are added we densify each block to 1 row, allowing up to 8, then add
  // a third column for up to 12.
  const numCols = shortcuts.length > 8 ? 3 : 2;
  // Rows each shortcut spans: 2 while there's room (<=4 in 2-col), else 1.
  const rowSpan = shortcuts.length <= numCols * 2 ? 2 : 1;

  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');
  const [type, setType] = useState<'url' | 'entity'>('url');
  const [editingId, setEditingId] = useState<string | null>(null);
  const dragIdx = useRef<number | null>(null);

  const handleDragStart = (idx: number) => { dragIdx.current = idx; };
  const handleDrop = (targetIdx: number) => {
    if (dragIdx.current === null || dragIdx.current === targetIdx) return;
    const reordered = [...shortcuts];
    const [moved] = reordered.splice(dragIdx.current, 1);
    reordered.splice(targetIdx, 0, moved);
    onUpdateData({ shortcuts: reordered });
    dragIdx.current = null;
  };

  const handleAdd = () => {
    if (!newValue.trim()) return;
    const label = newLabel.trim() || (type === 'entity' ? entities.find(e => e.id === newValue)?.title : 'Link') || 'Link';

    let newShortcuts;
    if (editingId) {
      newShortcuts = shortcuts.map(s => s.id === editingId ? { ...s, type, label, value: newValue.trim() } : s);
    } else {
      newShortcuts = [...shortcuts, {
        id: crypto.randomUUID(),
        type,
        label,
        value: newValue.trim()
      }].slice(0, 12);
    }

    onUpdateData({ shortcuts: newShortcuts });
    setNewLabel('');
    setNewValue('');
    setIsAdding(false);
    setEditingId(null);
  };

  const removeShortcut = (id: string) => {
    onUpdateData({ shortcuts: shortcuts.filter(s => s.id !== id) });
  };

  return (
    <section className="bg-panel group/widget px-5 pb-5 pt-4 widget-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-widget-header font-semibold text-muted-foreground">
          Shortcuts
        </h2>
        {shortcuts.length < 12 && (
          <button
            onClick={() => setIsAdding(true)}
            className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-30)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] transition-all duration-200 ease-in-out"
          >
            <Plus strokeWidth={2} className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col no-scrollbar">
        {isAdding ? (
          <div className="space-y-3 p-3 bg-[var(--bone-5)] rounded-xl border border-[var(--bone-3)]">
            <div className="flex gap-1 p-0.5 bg-[var(--bone-10)] rounded-md">
              <button
                onClick={() => setType('url')}
                className={cn("flex-1 px-2 py-1 text-[10px] rounded", type === 'url' ? "bg-[var(--bone-20)] text-[var(--bone-100)]" : "text-muted-foreground")}
              >URL</button>
              <button
                onClick={() => setType('entity')}
                className={cn("flex-1 px-2 py-1 text-[10px] rounded", type === 'entity' ? "bg-[var(--bone-20)] text-[var(--bone-100)]" : "text-muted-foreground")}
              >Entity</button>
            </div>

            {type === 'entity' ? (
              <select
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                className="w-full bg-[var(--color-panel)] border border-[var(--bone-12)] rounded-md px-2 py-1.5 text-xs outline-none text-foreground"
              >
                <option value="">Select Page...</option>
                {entities.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            ) : (
              <input
                placeholder="https://..."
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                className="w-full bg-[var(--color-panel)] border border-[var(--bone-12)] rounded-md px-2 py-1.5 text-xs outline-none text-foreground"
              />
            )}

            <input
              placeholder="Label (optional)"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              className="w-full bg-[var(--color-panel)] border border-[var(--bone-12)] rounded-md px-2 py-1.5 text-xs outline-none text-foreground"
            />


            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                  setNewLabel('');
                  setNewValue('');
                }}
                className="text-[10px] text-muted-foreground"
              >
                Cancel
              </button>
              <button onClick={handleAdd} className="text-[10px] text-accent font-semibold">
                {editingId ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        ) : shortcuts.length > 0 ? (
          <div
            className="grid gap-2 flex-1 grid-flow-row"
            style={{
              gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))`,
              gridTemplateRows: 'repeat(4, minmax(0, 1fr))',
              gridAutoRows: 'minmax(0, 1fr)',
            }}
          >
            {shortcuts.map(s => (
              <ShortcutItem
                key={s.id}
                rowSpan={rowSpan}
                shortcut={s}
                entities={entities}
                onSelectEntity={setActiveEntityId}
                onRemove={removeShortcut}
                onEdit={(shortcutToEdit) => {
                  setEditingId(shortcutToEdit.id);
                  setNewLabel(shortcutToEdit.label);
                  setNewValue(shortcutToEdit.value);
                  setType(shortcutToEdit.type);
                  setIsAdding(true);
                }}
                dragProps={{
                  draggable: true,
                  onDragStart: () => handleDragStart(shortcuts.indexOf(s)),
                  onDragOver: (e: any) => e.preventDefault(),
                  onDrop: () => handleDrop(shortcuts.indexOf(s))
                }}
              />
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 p-4 bg-white/[0.01] rounded-[12px] min-h-[140px]">
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
  dragProps: any;
}

function ShortcutItem({ shortcut, entities, rowSpan, onSelectEntity, onRemove, onEdit, dragProps }: ShortcutItemProps) {
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
    Icon = ent ? getEntityIcon(ent.icon) : FileText;
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

  return (
    <div
      className="relative group/shortcut cursor-grab h-full"
      style={{ gridRow: `span ${rowSpan}` }}
      {...dragProps}
    >
      <button
        onClick={() => {
          if (isInternal) {
            onSelectEntity(shortcut.value);
          } else {
            window.open(shortcut.value, '_blank');
          }
        }}
        onContextMenu={handleContextMenu}
        className="relative w-full h-full flex items-center gap-3 pl-4 pr-5 py-3 rounded-[10px] bg-[var(--bone-5)] hover:bg-[var(--app-dark)] active:bg-[var(--bone-10)] text-left cursor-pointer group transition-colors duration-200 ease-in-out"
      >
        {!isInternal && faviconUrl && !imgError ? (
          <img
            src={faviconUrl}
            alt=""
            className="w-6 h-6 object-contain shrink-0 rounded-sm"
            onError={() => setImgError(true)}
          />
        ) : (
          <Icon className="w-6 h-6 text-[var(--bone-60)] group-hover/shortcut:text-[var(--bone-100)] shrink-0 transition-colors duration-200 ease-in-out" />
        )}
        <div className="min-w-0 flex-1 leading-normal pr-4">
          <span className="text-[12px] font-semibold text-[var(--bone-80)] group-hover/shortcut:text-[var(--bone-100)] truncate block">
            {shortcut.label}
          </span>
          <span className="text-[10px] text-[var(--bone-40)] group-hover/shortcut:text-[var(--bone-60)] truncate block mt-0.5">
            {displaySubtitle}
          </span>
        </div>
        <ExternalLink className="absolute right-5 top-1/2 w-3 h-3 text-[var(--bone-30)] opacity-0 -translate-x-1 -translate-y-1/2 group-hover/shortcut:opacity-100 group-hover/shortcut:translate-x-0 transition-[opacity,translate] duration-200 ease-in-out" />
      </button>

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
