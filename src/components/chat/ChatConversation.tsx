"use client";

import { useStore } from '@/data/store';
import { ChatMessage } from '@/components/assistant/components/ChatMessage';
import { AIAvatar } from '@/components/assistant/components/AIAvatar';
import { useRef, useEffect, useCallback } from 'react';
import { Brain, ArrowRight, Image as ImageIcon, Globe, Telescope, Terminal, CheckSquare, MessageCircleDashed } from 'lucide-react';
import { StatusTyping } from '@/components/assistant/components/StatusTyping';
import { DEFAULT_STATUS_MESSAGES } from '@/lib/router-config';
import { ChatMainSkeleton } from './ChatSkeleton';


export function ChatConversation({ isLoading }: { isLoading?: boolean }) {
  const aiMessages = useStore(s => s.aiMessages);
  const isAILoading = useStore(s => s.isAILoading);
  const isChatMessagesLoading = useStore(s => s.isChatMessagesLoading);
  const regenerateAIMessage = useStore(s => s.regenerateAIMessage);
  const setReplyMessage = useStore(s => s.setReplyMessage);
  const openModal = useStore(s => s.openModal);
  const aiSessionContext = useStore(s => s.aiSessionContext);
  const isCompacting = useStore(s => s.isCompacting);

  const activeChatId = useStore(s => s.activeChatId);
  const isTempChat = useStore(s => s.isTempChat);

  // A new or temporary chat has zero messages and nothing to fetch — there is
  // nothing to show a message skeleton for. Only show it when there's an
  // actual existing chat whose messages could still be loading.
  const hasNothingToLoad = isTempChat || !activeChatId;
  const isMinLoading = !hasNothingToLoad && (!!isLoading || isChatMessagesLoading);

  const messages = aiMessages;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);


  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  useEffect(() => {
    if (!isMinLoading) {
      requestAnimationFrame(() => {
        scrollToBottom('auto');
      });
    }
  }, [messages.length, isMinLoading, activeChatId, scrollToBottom]);

  const handleAddImageToWorkspace = () => { };

  const displayMessages = messages.filter(m => (m.role === 'user' || m.role === 'assistant') && !m.isHidden);

  if (isMinLoading) {
    return <ChatMainSkeleton />;
  }

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 min-w-0">
      {/* Message list */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pt-16 pb-60 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/30"
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

          {displayMessages.length === 0 && !isAILoading ? null : (
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
                      text={DEFAULT_STATUS_MESSAGES['COMPACTION'] || "Compressing..."}
                      className="font-normal text-[var(--bone-100)]"
                      style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: '15px', letterSpacing: '-0.01em' }}
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
