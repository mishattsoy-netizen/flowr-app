"use client";

import { useStore } from '@/data/store';
import { ChatMessage } from '@/components/assistant/components/ChatMessage';
import { AIAvatar } from '@/components/assistant/components/AIAvatar';
import { useRef, useEffect, useCallback } from 'react';
import { Brain, ArrowRight, Image as ImageIcon, Globe, Telescope, Terminal, CheckSquare, MessageCircleDashed } from 'lucide-react';
import { StatusTyping } from '@/components/assistant/components/StatusTyping';
import { AIAssistant } from '@/components/assistant/AIAssistant';
import { useAuth } from '@/components/AuthProvider';

const QUICK_ACCESS_PILLS = [
  { id: 'image', label: 'Generate Image', prefix: '/image ', icon: ImageIcon },
  { id: 'search', label: 'Web Search', prefix: '/search ', icon: Globe },
  { id: 'research', label: 'Deep Research', prefix: '/research ', icon: Telescope },
  { id: 'task', label: 'New Task', prefix: '/task ', icon: CheckSquare },
];

export function ChatConversation() {
  const aiMessages = useStore(s => s.aiMessages);
  const isAILoading = useStore(s => s.isAILoading);
  const isTempChat = useStore(s => s.isTempChat);
  const tempChatGreeting = useStore(s => s.tempChatGreeting);
  const sendAIMessage = useStore(s => s.sendAIMessage);
  const regenerateAIMessage = useStore(s => s.regenerateAIMessage);
  const setAssistantInput = useStore(s => s.setAssistantInput);
  const setReplyMessage = useStore(s => s.setReplyMessage);
  const openModal = useStore(s => s.openModal);
  const aiSessionContext = useStore(s => s.aiSessionContext);
  const isCompacting = useStore(s => s.isCompacting);
  const { user } = useAuth();

  const messages = aiMessages;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handlePillClick = (pill: typeof QUICK_ACCESS_PILLS[0]) => {
    setAssistantInput(pill.prefix);
    setTimeout(() => {
      document.querySelector('textarea')?.focus();
    }, 50);
  };

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  useEffect(() => {
    scrollToBottom('auto');
  }, [messages.length]);

  const handleAddImageToWorkspace = () => { };

  const displayMessages = messages.filter(m => (m.role === 'user' || m.role === 'assistant') && !m.isHidden);

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      {/* Message list */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-6 pt-16 pb-60 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/30"
        style={{ overflowAnchor: 'auto' }}
      >
        <div className="max-w-3xl mx-auto space-y-4">
          {aiSessionContext?.distilled_summary && (
            <div
              onClick={() => openModal({ kind: 'summaryPreview', summary: aiSessionContext.distilled_summary! })}
              className="my-3 mx-1 p-3 rounded-[12px] border border-[var(--bone-12)] bg-white/[0.02] hover:bg-white/[0.06] active:scale-[0.99] transition-all cursor-pointer flex items-center justify-between group select-none shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-full bg-white/[0.04] border border-[var(--bone-12)] flex items-center justify-center text-bone-70 group-hover:text-accent group-hover:border-accent/30 transition-all shrink-0">
                  <Brain className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col items-start text-left min-w-0">
                  <span className="text-[11px] font-semibold text-bone-90 group-hover:text-bone-100 tracking-tight leading-none">Conversation Condensed</span>
                  <span className="text-[9.5px] text-bone-40 tracking-tight mt-1 truncate max-w-full">Prior messages distilled to maximize context. Click to view.</span>
                </div>
              </div>
              <div className="text-[10px] font-semibold text-bone-30 group-hover:text-accent flex items-center gap-1 shrink-0 ml-2 transition-colors">
                <span>View</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          )}

          {displayMessages.length === 0 && !isAILoading ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] text-center gap-0 pt-20 max-w-4xl mx-auto w-full px-6">
              {isTempChat ? (
                <div className="flex flex-col items-center mb-8 select-none animate-fade-in relative">
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
                /* Welcome Title */
                <div className="flex flex-col items-center mb-8 select-none animate-fade-in">
                  <AIAvatar className="w-10 h-10 opacity-100 mb-4" />
                  <h1 className="text-[32px] font-normal text-[var(--bone-100)] leading-tight tracking-tight font-display mb-0">
                    {getGreeting()}
                  </h1>
                </div>
              )}

              {/* Message Bar in the middle */}
              <div className="w-full">
                <AIAssistant chatPageMode={true} />
              </div>

              <div className="flex justify-center max-w-3xl mt-3">
                <div className="flex flex-wrap gap-1.5 select-none">
                  {QUICK_ACCESS_PILLS.map(pill => {
                    const Icon = pill.icon;
                    return (
                      <button
                        key={pill.id}
                        onClick={() => handlePillClick(pill)}
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
            </div>
          ) : (
            <>
              {displayMessages.map((msg, idx) => (
                <div key={msg.id || `msg-${idx}`} className="w-full">
                  <ChatMessage
                    msg={msg}
                    isAILoading={idx === displayMessages.length - 1 ? isAILoading : false}
                    isLast={idx === displayMessages.length - 1}
                    scrollToBottom={scrollToBottom}
                    handleAddImageToWorkspace={handleAddImageToWorkspace}
                    onRegenerate={msg.role === 'assistant' && msg.id ? () => {
                      const lastUser = [...displayMessages.slice(0, idx + 1)].reverse().find(m => m.role === 'user');
                      if (lastUser && msg.id) regenerateAIMessage(msg.id, lastUser.content ?? '', lastUser.attachments);
                    } : undefined}
                    onReply={setReplyMessage}
                  />
                </div>
              ))}
              {isCompacting && (
                <div className="w-full pb-3 flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                    <AIAvatar isTyping={true} className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusTyping
                      text={(() => {
                        const custom = aiSessionContext?.status_messages?.COMPACTION;
                        if (custom) return `${custom.emoji} ${custom.label}`.trim();
                        return "🚀 Compressing...";
                      })()}
                      className="font-normal text-[var(--bone-100)]"
                      style={{ fontFamily: '"Literata"', fontWeight: 400, fontSize: '13px', letterSpacing: '-0.01em' }}
                    />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
