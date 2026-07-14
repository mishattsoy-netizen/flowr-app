"use client";

import { useStore } from '@/data/store';
import { ChatConversation } from './ChatConversation';
import { AIAssistant } from '@/components/assistant/AIAssistant';
import { AIAvatar } from '@/components/assistant/components/AIAvatar';
import { useAuth } from '@/components/AuthProvider';
import { Eraser, Trash2, Bookmark, Image as ImageIcon, Globe, Telescope, CheckSquare, MessageCircleDashed, Download } from 'lucide-react';
import { Tooltip } from '@/components/layout/Tooltip';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';

const QUICK_ACCESS_PILLS = [
  { id: 'image', label: 'Generate Image', prefix: '/image ', icon: ImageIcon },
  { id: 'search', label: 'Web Search', prefix: '/search ', icon: Globe },
  { id: 'research', label: 'Deep Research', prefix: '/research ', icon: Telescope },
  { id: 'task', label: 'New Task', prefix: '/task ', icon: CheckSquare },
];

export default function ChatPage({ isLoading }: { isLoading?: boolean }) {
  const activeChatId = useStore(s => s.activeChatId);
  const chatConversations = useStore(s => s.chatConversations);
  const isTempChat = useStore(s => s.isTempChat);
  const aiMessages = useStore(s => s.aiMessages);
  const isAILoading = useStore(s => s.isAILoading);
  const isChatMessagesLoading = useStore(s => s.isChatMessagesLoading);
  const tempChatGreeting = useStore(s => s.tempChatGreeting);
  const { user } = useAuth();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isEditingTitle]);

  const handleTitleSave = async () => {
    setIsEditingTitle(false);
    const activeConv = useStore.getState().chatConversations.find(c => c.id === activeChatId);
    if (activeConv && editTitleValue.trim() && editTitleValue !== activeConv.title) {
      await useStore.getState().renameChatConversation(activeConv.id, editTitleValue.trim());
    }
  };

  const getGreeting = () => {
    if (isTempChat) {
      return tempChatGreeting || "Write like nobody's listening.";
    }

    const hours = new Date().getHours();
    let greet = 'Afternoon';
    if (hours >= 5 && hours < 12) greet = 'Morning';
    else if (hours >= 12 && hours < 17) greet = 'Afternoon';
    else greet = 'Evening';

    const meta = user?.user_metadata || {};
    const displayName = meta.display_name || meta.full_name || user?.email?.split('@')[0] || '';
    return displayName ? `${greet}, ${displayName}` : greet;
  };

  const activeConv = chatConversations.find(c => c.id === activeChatId);
  const title = isTempChat ? 'Temporary Chat' : (activeConv?.title || 'New Chat');

  const handleExportTranscript = () => {
    const transcriptMessages = aiMessages.filter(m => (m.role === 'user' || m.role === 'assistant') && !m.isHidden);
    
    let content = `# Session: ${title}\n\n`;
    
    transcriptMessages.forEach(m => {
      const time = m.timestamp ? new Date(m.timestamp).toLocaleString() : new Date().toLocaleString();
      const role = m.role === 'user' ? 'User' : 'Flowr AI';
      let msgText = `[${time}] ${role}:\n${m.content || ''}`;

      if (m.toolResults && m.toolResults.length > 0) {
        m.toolResults.forEach(tr => {
          if (tr.type && tr.title) {
            let label = tr.type.replace(/_/g, ' ').toUpperCase();
            if (label.startsWith('CREATE ')) label = label.replace('CREATE ', 'NEW ');
            msgText += `\n\n[${label}] ${tr.title}`;
          }
        });
      }

      content += msgText.trim() + `\n\n`;
    });

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_transcript.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const displayMessages = aiMessages.filter(m => (m.role === 'user' || m.role === 'assistant') && !m.isHidden);
  const showBottomBar = displayMessages.length > 0 || isAILoading || isChatMessagesLoading || isLoading;

  return (
    <div className="flex-1 flex flex-col h-full w-full min-h-0 bg-background">
      <div className="flex-1 min-w-0 min-h-0 relative h-full flex flex-col isolate">

        {/* Radial Glow — new chat: centered */}
        {displayMessages.length === 0 && (
          <div
            className="absolute pointer-events-none rounded-full left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] opacity-100 blur-[100px]"
            style={{
              backgroundColor: isTempChat
                ? 'color-mix(in srgb, var(--bone-100) 20%, transparent)'
                : 'color-mix(in srgb, var(--accent) 20%, transparent)',
              zIndex: -1,
            }}
          />
        )}

        {/* Scroll area fills entire parent — bar floats over it */}
        <ChatConversation isLoading={isLoading} />

        {/* Top fade + title */}
        <div
          className="absolute top-0 left-0 right-0 h-20 pointer-events-none flex items-start justify-between px-6 pt-5 gap-3"
          style={{ zIndex: 40, background: 'linear-gradient(to bottom, var(--color-background) 0%, transparent 100%)' }}
        >
          <div className="flex items-center gap-3">
            {!isTempChat && activeConv?.title && (
              <div 
                className={cn(
                  "pointer-events-auto flex items-center max-w-[300px] bg-[var(--bone-6)] border rounded-[6px] px-2 py-1 transition-colors cursor-text",
                  isEditingTitle ? "border-[var(--brand-blue)]" : "border-[var(--bone-6)] hover:border-[var(--bone-12)] focus-within:border-[var(--brand-blue)]"
                )}
                onDoubleClick={() => {
                  setIsEditingTitle(true);
                  setEditTitleValue(activeConv.title);
                }}
              >
                <div className="grid items-center min-w-[10px]">
                  <span className={cn(
                    "col-start-1 row-start-1 text-[13px] font-medium tracking-wide truncate whitespace-pre",
                    isEditingTitle ? "invisible" : "text-[var(--bone-100)] select-none"
                  )}>
                    {isEditingTitle ? (editTitleValue || ' ') : activeConv.title}
                  </span>
                  {isEditingTitle && (
                    <input
                      ref={titleInputRef}
                      value={editTitleValue}
                      onChange={(e) => setEditTitleValue(e.target.value)}
                      onBlur={handleTitleSave}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleTitleSave();
                        if (e.key === 'Escape') setIsEditingTitle(false);
                      }}
                      className="col-start-1 row-start-1 text-[13px] font-medium text-[var(--bone-100)] tracking-wide bg-transparent outline-none w-full min-w-0 p-0 m-0 border-none"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isTempChat && (
              <>
                <Tooltip content="Clear Chat">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      useStore.getState().clearAIChat();
                    }}
                    className="pointer-events-auto w-8 h-8 flex items-center justify-center rounded-[8px] hover:bg-[var(--bone-6)] text-[var(--bone-100)] opacity-60 hover:opacity-100 transition-colors shrink-0 cursor-pointer"
                  >
                    <Eraser strokeWidth={2} className="w-5 h-5" />
                  </button>
                </Tooltip>
                <Tooltip content="Save Chat">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      useStore.getState().saveTempChat();
                    }}
                    className="pointer-events-auto w-8 h-8 flex items-center justify-center rounded-[8px] hover:bg-[var(--bone-6)] text-[var(--bone-100)] opacity-60 hover:opacity-100 transition-colors shrink-0 cursor-pointer"
                  >
                    <Bookmark strokeWidth={2} className="w-5 h-5" />
                  </button>
                </Tooltip>
              </>
            )}

            {!isTempChat && activeChatId && (
              <>
                <Tooltip content="Export Transcript">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportTranscript();
                    }}
                    className="pointer-events-auto w-8 h-8 flex items-center justify-center rounded-[8px] hover:bg-[var(--bone-6)] text-[var(--bone-100)] opacity-60 hover:opacity-100 transition-colors shrink-0 cursor-pointer"
                  >
                    <Download strokeWidth={2} className="w-5 h-5" />
                  </button>
                </Tooltip>
                <Tooltip content="Delete Chat">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      useStore.getState().openModal({ kind: 'deleteConfirm', entityId: activeChatId, isChat: true });
                    }}
                    className="pointer-events-auto w-8 h-8 flex items-center justify-center rounded-[8px] text-[var(--bone-100)] opacity-60 hover:opacity-100 hover:text-danger hover:bg-danger/10 transition-all shrink-0 cursor-pointer"
                  >
                    <Trash2 strokeWidth={2} className="w-5 h-5" />
                  </button>
                </Tooltip>
              </>
            )}
          </div>
        </div>

        {/* Fade behind bar — same height as bar+gap, z-index below bar */}
        <div
          className={cn(
            "absolute left-0 right-0 bottom-0 pointer-events-none transition-opacity duration-0",
            showBottomBar ? "opacity-100" : "opacity-0"
          )}
          style={{ zIndex: 38, height: '140px', background: 'linear-gradient(to bottom, transparent 0%, var(--color-background) 55%)' }}
        />

        {/* Floating glass bar */}
        <div
          className={cn(
            "absolute left-0 right-0 flex justify-center",
            showBottomBar ? "bottom-0 pb-8 pt-2" : "top-[46%] -translate-y-1/2"
          )}
          style={{ zIndex: 40 }}
        >
          <div className={cn(
            "w-full mx-auto px-6 flex flex-col items-center",
            showBottomBar ? "max-w-4xl" : "max-w-3xl"
          )}>

            <div className={cn(
              "relative w-full flex flex-col items-center",
              !showBottomBar ? "scale-[1.02]" : "scale-100"
            )}>
              {!showBottomBar && (
                isTempChat ? (
                  <div className="absolute bottom-full mb-8 flex flex-col items-center select-none animate-fade-in w-full text-center">
                    <MessageCircleDashed className="w-10 h-10 text-[var(--bone-40)] mb-4" strokeWidth={1.5} />
                    <h1 className="text-[32px] font-normal text-[var(--bone-100)] leading-tight tracking-tight font-display mb-0">
                      {getGreeting()}
                    </h1>
                    <div className="absolute top-[100%] mt-1 left-1/2 -translate-x-1/2 w-full whitespace-nowrap">
                      <p className="text-[13px] leading-relaxed text-[var(--bone-60)] max-w-md mx-auto">
                        This chat is temporary. It will disappear if you don't save it.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="absolute bottom-full mb-8 flex flex-col items-center select-none animate-fade-in w-full text-center">
                    <AIAvatar className="w-10 h-10 opacity-100 mb-4" />
                    <h1 className="text-[32px] font-normal text-[var(--bone-100)] leading-tight tracking-tight font-display mb-0">
                      {getGreeting()}
                    </h1>
                  </div>
                )
              )}

              <AIAssistant chatPageMode={true} />

              {showBottomBar && (
                <div className="absolute top-[100%] mt-2 w-full flex justify-center pointer-events-none select-none">
                  <span className="text-[12px] text-[var(--bone-60)] font-normal tracking-wide">
                    Flowr AI can make mistakes. Please verify important information.
                  </span>
                </div>
              )}

              {!showBottomBar && (
                <div className="absolute top-full mt-4 flex justify-center max-w-3xl w-full">
                  <div className="flex flex-wrap gap-1.5 select-none justify-center">
                    {QUICK_ACCESS_PILLS.map(pill => {
                      const Icon = pill.icon;
                      return (
                        <button
                          key={pill.id}
                          onClick={() => {
                            useStore.getState().setAssistantInput(pill.prefix);
                            setTimeout(() => {
                              document.querySelector('textarea')?.focus();
                            }, 50);
                          }}
                          className="mono-pill group flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--bone-6)] hover:bg-[var(--bone-10)] text-[var(--bone-100)] text-[12px] font-medium tracking-tight active:scale-[0.98] shrink-0 transition-colors"
                        >
                          <span className="shrink-0 text-[var(--bone-100)] opacity-60 group-hover:opacity-100 transition-opacity">
                            <Icon strokeWidth={1.5} className="w-4 h-4 shrink-0" />
                          </span>
                          <span className="text-[var(--bone-100)]">{pill.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
