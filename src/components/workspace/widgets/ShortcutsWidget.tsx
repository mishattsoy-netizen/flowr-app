"use client";

import { useStore } from '@/data/store';
import { Plus, X, ExternalLink, FileText, Layout } from 'lucide-react';
import { useState } from 'react';
import { getEntityIcon } from '@/data/icons';
import clsx from 'clsx';

interface Shortcut {
  id: string;
  type: 'url' | 'entity';
  label: string;
  value: string; // URL or Entity ID
  icon?: string;
}

export function ShortcutsWidget({ data, onUpdateData }: { data?: { shortcuts?: Shortcut[] }; onUpdateData: (newData: any) => void }) {
  const shortcuts = data?.shortcuts || [];
  const entities = useStore(state => state.entities);
  const setActiveEntityId = useStore(state => state.setActiveEntityId);
  
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');
  const [type, setType] = useState<'url' | 'entity'>('url');

  const handleAdd = () => {
    if (!newValue.trim()) return;
    const label = newLabel.trim() || (type === 'entity' ? entities.find(e => e.id === newValue)?.title : 'Link') || 'Link';
    
    const newShortcuts = [...shortcuts, { 
      id: crypto.randomUUID(), 
      type, 
      label, 
      value: newValue.trim() 
    }].slice(0, 8);
    
    onUpdateData({ shortcuts: newShortcuts });
    setNewLabel('');
    setNewValue('');
    setIsAdding(false);
  };

  const removeShortcut = (id: string) => {
    onUpdateData({ shortcuts: shortcuts.filter(s => s.id !== id) });
  };

  return (
    <section className="bg-sidebar border border-[var(--bone-10)] group/widget px-5 pb-5 pt-4 rounded-[var(--radius-big)] widget-shadow h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-widget-header font-semibold text-muted-foreground group-hover/widget:text-foreground">
          Shortcuts
        </h2>
        {shortcuts.length < 8 && (
          <button
            onClick={() => setIsAdding(true)}
            className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-30)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {isAdding ? (
          <div className="space-y-3 p-3 bg-[var(--bone-5)] rounded-xl border border-[var(--bone-10)]">
            <div className="flex gap-1 p-0.5 bg-[var(--bone-10)] rounded-md">
              <button 
                onClick={() => setType('url')}
                className={clsx("flex-1 px-2 py-1 text-[10px] rounded", type === 'url' ? "bg-[var(--bone-20)] text-[var(--bone-100)]" : "text-muted-foreground")}
              >URL</button>
              <button 
                onClick={() => setType('entity')}
                className={clsx("flex-1 px-2 py-1 text-[10px] rounded", type === 'entity' ? "bg-[var(--bone-20)] text-[var(--bone-100)]" : "text-muted-foreground")}
              >Entity</button>
            </div>
            
            {type === 'entity' ? (
              <select 
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                className="w-full bg-[var(--color-panel)] border border-[var(--bone-10)] rounded-md px-2 py-1.5 text-xs outline-none text-foreground"
              >
                <option value="">Select Page...</option>
                {entities.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            ) : (
              <input
                placeholder="https://..."
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                className="w-full bg-[var(--color-panel)] border border-[var(--bone-10)] rounded-md px-2 py-1.5 text-xs outline-none text-foreground"
              />
            )}
            
            <input
              placeholder="Label (optional)"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              className="w-full bg-[var(--color-panel)] border border-[var(--bone-10)] rounded-md px-2 py-1.5 text-xs outline-none text-foreground"
            />
            
            <div className="flex gap-2 justify-end">
              <button onClick={() => setIsAdding(false)} className="text-[10px] text-muted-foreground">Cancel</button>
              <button onClick={handleAdd} className="text-[10px] text-accent font-semibold">Add</button>
            </div>
          </div>
        ) : shortcuts.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(70px,1fr))] gap-3">
            {shortcuts.map(s => {
              let Icon = ExternalLink;
              let isInternal = s.type === 'entity';
              
              if (isInternal) {
                const ent = entities.find(e => e.id === s.value);
                Icon = ent ? getEntityIcon(ent.icon) : FileText;
              }

              return (
                <div key={s.id} className="relative group/shortcut">
                  <button
                    onClick={() => {
                      if (isInternal) {
                        setActiveEntityId(s.value);
                      } else {
                        window.open(s.value, '_blank');
                      }
                    }}
                    className="w-full aspect-square flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-[var(--bone-5)] border border-[var(--bone-10)] hover:border-accent/40 hover:bg-[var(--bone-6)] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[var(--bone-10)] flex items-center justify-center text-accent group-hover/shortcut:scale-110 group-hover/shortcut:bg-[var(--bone-15)] transition-all duration-300">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-medium text-[var(--bone-60)] group-hover/shortcut:text-[var(--bone-100)] truncate w-full px-1 text-center transition-colors">
                      {s.label}
                    </span>
                  </button>
                  <button
                    onClick={() => removeShortcut(s.id)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500/90 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/shortcut:opacity-100 transition-all duration-200 shadow-md backdrop-blur-md"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-2 opacity-40">
            <Layout className="w-8 h-8 text-muted-foreground/20" />
            <p className="text-[11px] text-muted-foreground font-medium text-center">No shortcuts yet</p>
          </div>
        )}
      </div>
    </section>
  );
}
