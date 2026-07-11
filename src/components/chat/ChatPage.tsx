"use client";

import { useStore } from '@/data/store';
import { ChatConversation } from './ChatConversation';
import { AIAssistant } from '@/components/assistant/AIAssistant';
import { Eraser, Trash2, Bookmark } from 'lucide-react';
import { Tooltip } from '@/components/layout/Tooltip';

export default function ChatPage({ isLoading }: { isLoading?: boolean }) {
  const activeChatId = useStore(s => s.activeChatId);
  const chatConversations = useStore(s => s.chatConversations);
  const isTempChat = useStore(s => s.isTempChat);
  const aiMessages = useStore(s => s.aiMessages);
  const isAILoading = useStore(s => s.isAILoading);

  const activeConv = chatConversations.find(c => c.id === activeChatId);
  const title = isTempChat ? 'Temporary Chat' : (activeConv?.title || 'New Chat');

  const displayMessages = aiMessages.filter(m => (m.role === 'user' || m.role === 'assistant') && !m.isHidden);
  const showBottomBar = displayMessages.length > 0 || isAILoading;

  return (
    <div className="flex h-full w-full bg-background">
      <div className="flex-1 min-w-0 relative h-full isolate">

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
          className="absolute top-0 left-0 right-0 h-16 pointer-events-none flex items-start justify-between px-6 pt-3 gap-3"
          style={{ zIndex: 40, background: 'linear-gradient(to bottom, var(--color-background) 0%, transparent 100%)' }}
        >
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-medium truncate text-[var(--bone-100)] tracking-wide">
              {title}
            </h2>
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
            )}
          </div>
        </div>

        {/* Fade behind bar — same height as bar+gap, z-index below bar */}
        {showBottomBar && (
          <div
            className="absolute left-0 right-0 bottom-0 pointer-events-none"
            style={{ zIndex: 38, height: '140px', background: 'linear-gradient(to bottom, transparent 0%, var(--color-background) 55%)' }}
          />
        )}

        {/* Floating glass bar */}
        {showBottomBar && (
          <div
            className="absolute left-0 right-0 bottom-0 pb-8 pt-2 flex justify-center"
            style={{ zIndex: 40 }}
          >
            <div className="w-full max-w-4xl mx-auto px-6">
              <AIAssistant chatPageMode={true} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
