"use client";

import { useStore } from '@/data/store';
import { Plus, Clock, ChevronLeft, Trash2, Pencil, MoreHorizontal, MessageCircleDashed } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { ChatConversation } from '@/lib/chat';

function groupByDate(convs: ChatConversation[]): Record<string, ChatConversation[]> {
  const now = Date.now();
  const oneDayMs = 86400000;
  const groups: Record<string, ChatConversation[]> = {
    Today: [],
    Yesterday: [],
    'Last 7 days': [],
    Older: [],
  };
  for (const c of convs) {
    const age = now - new Date(c.updated_at).getTime();
    if (age < oneDayMs) groups['Today'].push(c);
    else if (age < oneDayMs * 2) groups['Yesterday'].push(c);
    else if (age < oneDayMs * 7) groups['Last 7 days'].push(c);
    else groups['Older'].push(c);
  }
  return groups;
}

export function ChatHistoryPanel() {
  const chatHistoryOpen = useStore(s => s.chatHistoryOpen);
  const setChatHistoryOpen = useStore(s => s.setChatHistoryOpen);
  const chatConversations = useStore(s => s.chatConversations);
  const activeChatId = useStore(s => s.activeChatId);
  const startNewChat = useStore(s => s.startNewChat);
  const startTempChat = useStore(s => s.startTempChat);
  const loadConversation = useStore(s => s.loadConversation);
  const loadChatConversations = useStore(s => s.loadChatConversations);
  const deleteChatConversation = useStore(s => s.deleteChatConversation);
  const renameChatConversation = useStore(s => s.renameChatConversation);
  const isTempChat = useStore(s => s.isTempChat);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadChatConversations();
  }, []);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleDeleteConfirm = () => {
    if (confirmDeleteId) {
      deleteChatConversation(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  };

  const handleRenameSubmit = (id: string) => {
    if (editTitle.trim()) renameChatConversation(id, editTitle.trim());
    setEditingId(null);
  };

  const groups = groupByDate(chatConversations);

  return (
    <div
      className={cn(
        "h-full flex flex-col bg-sidebar shrink-0 overflow-hidden transition-all duration-300 relative",
        chatHistoryOpen ? "w-[260px] border-r border-[var(--bone-10)]" : "w-0 border-r-0"
      )}
    >
      <div className="w-[260px] h-full flex flex-col shrink-0">
        {/* Delete confirm inline dialog */}
        {confirmDeleteId && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-overlay" onClick={() => setConfirmDeleteId(null)}>
            <div className="bg-panel border border-border/50 rounded-[1.25rem] p-5 w-[360px]" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold text-foreground mb-3">Delete conversation?</h2>
              <p className="text-sm text-muted-foreground mb-6">This will permanently delete this conversation and all its messages. This cannot be undone.</p>
              <div className="flex items-center justify-end gap-3">
                <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 border border-border/50 text-sm rounded-full text-muted-foreground hover:text-foreground hover:bg-hover">Cancel</button>
                <button onClick={handleDeleteConfirm} className="px-4 py-2 text-sm rounded-full bg-danger hover:bg-danger/80 text-white font-medium">Delete</button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-1">
          {/* Header actions */}
          <div className="flex items-center gap-1 mb-3 px-1">
            <button
              onClick={startNewChat}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Chat
            </button>
            <button
              onClick={startTempChat}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                isTempChat ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-hover"
              )}
            >
              <MessageCircleDashed className="w-3.5 h-3.5" />
              Temp
            </button>
          </div>

          {/* Grouped conversations */}
          {Object.entries(groups).map(([label, convs]) => {
            if (convs.length === 0) return null;
            return (
              <div key={label}>
                <div className="flex items-center pl-[10px] pr-1.5 h-7 rounded-[var(--radius-small)] text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)]">
                  <span className="text-[10px] font-ui-label font-medium uppercase tracking-wide">{label}</span>
                </div>
                <div className="space-y-0.5">
                {convs.map(conv => (
                  <div
                    key={conv.id}
                    className={cn(
                      "group flex items-center h-7 rounded-[var(--radius-small)] cursor-pointer select-none transition-colors",
                      activeChatId === conv.id
                        ? "bg-dark text-[var(--bone-100)]"
                        : "text-[var(--bone-70)] hover:text-[var(--bone-100)] [&:hover:not(:has(.sidebar-actions:hover))]:bg-[var(--app-dark)]"
                    )}
                    style={{ paddingLeft: '10px', paddingRight: '3px' }}
                    onClick={() => loadConversation(conv.id)}
                  >
                    {editingId === conv.id ? (
                      <input
                        ref={editInputRef}
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onBlur={() => handleRenameSubmit(conv.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameSubmit(conv.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        onClick={e => e.stopPropagation()}
                        className="flex-1 bg-transparent text-[13px] outline-none border-b border-white/30"
                      />
                    ) : (
                      <span className="flex-1 text-[13px] truncate leading-snug" style={{ color: 'inherit' }}>{conv.title}</span>
                    )}
                    <div className={cn(
                      "sidebar-actions flex items-center gap-[1px] shrink-0",
                      menuOpenId === conv.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setMenuPos({ x: rect.right + 4, y: rect.top });
                          setMenuOpenId(menuOpenId === conv.id ? null : conv.id);
                        }}
                        className={cn(
                          "btn-sidebar-utility",
                          menuOpenId === conv.id && "!bg-[var(--app-dark)] !text-[var(--bone-100)] !opacity-100"
                        )}
                      >
                        <MoreHorizontal strokeWidth={2} className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            );
          })}

          {chatConversations.length === 0 && (
            <p className="text-xs text-muted-foreground/60 text-center pt-8">No conversations yet</p>
          )}
        </div>

        {/* Collapse toggle */}
        <div className="shrink-0 border-t border-[var(--bone-6)] p-2 flex justify-end">
          <button
            onClick={() => setChatHistoryOpen(!chatHistoryOpen)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating context menu */}
      {menuOpenId && (
        <>
          <div className="fixed inset-0 z-[299]" onClick={() => setMenuOpenId(null)} />
          <div
            className="fixed z-[300] popup-glass-small min-w-[160px] p-1.5 flex flex-col gap-[3px]"
            style={{ left: menuPos.x, top: menuPos.y }}
          >
            <button
              onClick={() => {
                setEditingId(menuOpenId);
                setEditTitle(chatConversations.find(c => c.id === menuOpenId)?.title ?? '');
                setMenuOpenId(null);
              }}
              className="popup-item"
            >
              <Pencil strokeWidth={2} className="w-4 h-4 shrink-0" />
              Rename
            </button>
            <button
              onClick={() => { setConfirmDeleteId(menuOpenId); setMenuOpenId(null); }}
              className="popup-item-danger"
            >
              <Trash2 strokeWidth={2} className="w-4 h-4 shrink-0" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
