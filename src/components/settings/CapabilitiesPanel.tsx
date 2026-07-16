"use client";

import { useEffect, useState } from 'react';
import { getBotMemories, addBotMemory, updateBotMemory, deleteBotMemory, type BotMemory } from '@/app/settings/capabilities/actions';
import { Brain, MoreVertical, Edit2, Trash2, Plus, X, Loader2 } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';
import { useStore } from '@/data/store';

export default function CapabilitiesPanel() {
  const [memories, setMemories] = useState<BotMemory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchMemories();
  }, []);

  const fetchMemories = async () => {
    setIsLoading(true);
    const data = await getBotMemories();
    setMemories(data);
    setIsLoading(false);
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormTitle('');
    setFormContent('');
    setError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (mem: BotMemory) => {
    setEditingId(mem.id);
    setFormTitle(mem.title);
    setFormContent(mem.content);
    setError('');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim()) {
      setError('Title and content are required.');
      return;
    }
    
    setIsSaving(true);
    setError('');

    let res;
    if (editingId) {
      res = await updateBotMemory(editingId, formTitle, formContent);
    } else {
      res = await addBotMemory(formTitle, formContent);
    }

    if (res.success) {
      await fetchMemories();
      setIsModalOpen(false);
    } else {
      setError(res.error || 'Failed to save memory');
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this memory?')) {
      const res = await deleteBotMemory(id);
      if (res.success) {
        await fetchMemories();
      } else {
        alert(res.error || 'Failed to delete');
      }
    }
  };

  if (isLoading) {
    return <div className="text-bone-70 text-[13px] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading memories...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[14px] font-medium text-bone-100">Bot Memory</h4>
          <p className="text-[13px] text-bone-70 mt-0.5">
            Facts and details the AI remembers about you. Governed by your Brain's token budget, not a fixed count.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium bg-[#3f3f3e] hover:bg-[#4a4a49] text-bone-100 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Memory
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {memories.length === 0 ? (
          <div className="p-8 text-center rounded-[14px] border border-dashed border-bone-10">
            <p className="text-[13px] text-bone-70">No memories yet. You can add one manually or let the AI learn over time.</p>
          </div>
        ) : (
          memories.map(mem => (
            <div key={mem.id} className="flex items-center gap-3 w-full px-4 py-3 rounded-[14px] transition-all duration-200 bg-white/5 hover:bg-white/10 border border-white/10 group/card">
              <div className="flex items-center text-bone-80 opacity-30 shrink-0 group-hover/card:opacity-80 transition-all">
                <Brain strokeWidth={1.5} className="w-8 h-8" />
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <p className="text-base font-serif font-medium tracking-tight text-bone-100 opacity-80 group-hover/card:opacity-100 transition-opacity truncate">{mem.title}</p>
                <p className="text-xs text-bone-40 truncate mt-0.5">{mem.content}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity">
                <button
                  onClick={() => handleOpenEdit(mem)}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-bone-40 hover:text-bone-100 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-bone-40 hover:text-bone-100 transition-colors">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      align="end"
                      sideOffset={4}
                      className="min-w-[140px] z-[999] bg-[#2b2a29] border border-[#3e3d3c] rounded-[10px] p-1 shadow-xl animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
                    >
                      <DropdownMenu.Item
                        onSelect={() => handleOpenEdit(mem)}
                        className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] text-bone-100 font-medium rounded-md hover:bg-white/5 outline-none cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 opacity-70" />
                        Edit details
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        onSelect={() => handleDelete(mem.id)}
                        className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] text-red-400 font-medium rounded-md hover:bg-red-500/10 outline-none cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 opacity-70" />
                        Delete memory
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#2b2a29] border border-[#3e3d3c] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#3e3d3c]">
              <h2 className="text-[15px] font-semibold text-bone-100">
                {editingId ? 'Edit Memory' : 'Add Memory'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-bone-70 hover:text-bone-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex flex-col gap-4 p-5">
              {error && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px]">
                  {error}
                </div>
              )}
              
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-bone-70">Title</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g. Current Project"
                  className="w-full bg-[var(--bone-6)] border border-transparent hover:border-[var(--bone-12)] focus:border-[var(--brand-blue)] rounded-md px-3 py-2 text-[13px] text-bone-100 outline-none transition-colors"
                  maxLength={50}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-bone-70">Fact / Details</label>
                <textarea
                  value={formContent}
                  onChange={e => setFormContent(e.target.value)}
                  placeholder="e.g. I am currently learning Rust and working on a small game."
                  className="w-full bg-[var(--bone-6)] border border-transparent hover:border-[var(--bone-12)] focus:border-[var(--brand-blue)] rounded-md px-3 py-2 text-[13px] text-bone-100 outline-none transition-colors min-h-[100px] resize-none"
                  maxLength={500}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#3e3d3c] bg-white/[0.02]">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-1.5 rounded-lg text-[13px] font-medium text-bone-100 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-[13px] font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
