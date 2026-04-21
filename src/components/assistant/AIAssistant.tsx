"use client";

import { useStore } from '@/data/store';
import type { AIAttachment, EditorBlock } from '@/data/store';
import { generateId } from '@/data/store';
import { X, Send, Trash2, Key, PanelRight, PanelLeft, Plus, ChevronUp, Image as ImageIcon, Paperclip, Square, Mic, Settings2 } from 'lucide-react';
import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { StarIcon } from './components/StarIcon';
import { AIAvatar } from './components/AIAvatar';
import { ChatAudioPlayer } from './components/ChatAudioPlayer';
import { ChatMessage } from './components/ChatMessage';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import clsx from 'clsx';

const AIAssistantComponent = ({ isFloating = false }: { isFloating?: boolean }) => {
  const isAIAssistantOpen = useStore(state => state.isAIAssistantOpen);
  const isAIAssistantExtended = useStore(state => state.isAIAssistantExtended);
  const toggleAIAssistant = useStore(state => state.toggleAIAssistant);
  const setAIAssistantOpen = useStore(state => state.setAIAssistantOpen);
  const toggleAIAssistantExtended = useStore(state => state.toggleAIAssistantExtended);
  const aiMessages = useStore(state => state.aiMessages);
  const stopAIGeneration = useStore(state => state.stopAIGeneration);
  const openModal = useStore(state => state.openModal);
  const sendAIMessage = useStore(state => state.sendAIMessage);
  const clearAIChat = useStore(state => state.clearAIChat);
  const isAILoading = useStore(state => state.isAILoading);
  const activeEntityId = useStore(state => state.activeEntityId);
  const updateEntityContent = useStore(state => state.updateEntityContent);

  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setIsHoveringToggle] = useState(false);
  const [agentEnabled, setAgentEnabled] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [attachments, setAttachments] = useState<AIAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    isRecording,
    audioBlob,
    microphones,
    selectedMicId,
    setSelectedMicId,
    volume,
    startRecording,
    stopRecording
  } = useVoiceRecorder();
  const [showMicSettings, setShowMicSettings] = useState(false);
  const [micSettingsPos, setMicSettingsPos] = useState({ x: 0, y: 0 });
  const [, setIsTranscribing] = useState(false);

  const actualExtended = isFloating ? false : isAIAssistantExtended;

  useEffect(() => { setIsMounted(true); }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  const checkScrollability = useCallback(() => {
    const container = messagesContainerRef.current;
    if (container) {
      const hasActualOverflow = container.scrollHeight > container.clientHeight + 5;
      const hasMessages = aiMessages.length > 0 || isAILoading;
      const shouldBeScrollable = hasActualOverflow && hasMessages;
      if (isScrollable !== shouldBeScrollable) {
        setIsScrollable(shouldBeScrollable);
      }
    }
  }, [isScrollable, aiMessages.length, isAILoading]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    checkScrollability();

    const mutationObserver = new MutationObserver(checkScrollability);
    mutationObserver.observe(container, { childList: true, subtree: true, characterData: true });

    const resizeObserver = new ResizeObserver((entries) => {
      checkScrollability();
      if (!isAILoading) return;
      const container = entries[0].target;
      const threshold = 120;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
      if (isNearBottom) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
      }
    });

    resizeObserver.observe(container);
    window.addEventListener('resize', checkScrollability);

    return () => {
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('resize', checkScrollability);
    };
  }, [checkScrollability, isAILoading]);

  // Handle click outside for floating mode
  useEffect(() => {
    if (!isFloating || !isAIAssistantOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setAIAssistantOpen(false);
      }
    };

    // Use a small delay or mousedown to avoid closing immediately when opened
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFloating, isAIAssistantOpen, setAIAssistantOpen]);

  useEffect(() => {
    if (!actualExtended && containerRef.current) {
      if (isAIAssistantOpen) {
        containerRef.current.style.display = 'flex';
        containerRef.current.style.opacity = '1';
        containerRef.current.style.transform = 'scale(1) translateY(0)';
        scrollToBottom('auto');
      } else {
        containerRef.current.style.display = 'none';
        containerRef.current.style.opacity = '0';
      }
    }
  }, [isAIAssistantOpen, actualExtended, scrollToBottom]);

  const handleSend = async (overrideContent?: string, overrideAttachments?: AIAttachment[]) => {
    const finalContent = overrideContent !== undefined ? overrideContent : input.trim();
    const finalAttachments = overrideAttachments !== undefined ? overrideAttachments : [...attachments];

    if ((!finalContent && finalAttachments.length === 0) || isAILoading || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const isSad = ['bad', 'error', 'stop', 'stupid', 'hate'].some(w => finalContent.toLowerCase().includes(w));
      window.dispatchEvent(new CustomEvent('ai-chat-sent', { detail: { isSad } }));

      if (overrideContent === undefined) setInput('');
      if (overrideAttachments === undefined) setAttachments([]);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';

      await sendAIMessage(finalContent, agentEnabled, finalAttachments);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (audioBlob) {
      handleAudioTranscription(audioBlob);
    }
  }, [audioBlob]);

  const handleAudioTranscription = async (blob: Blob) => {
    try {
      setIsTranscribing(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const attachment: AIAttachment = {
          type: 'audio',
          url: base64data,
          name: `recording-${Date.now()}.webm`
        };

        try {
          const formData = new FormData();
          formData.append('file', blob, 'recording.webm');
          formData.append('model', 'whisper-large-v3-turbo');

          const headers: Record<string, string> = {};
          if (isSupabaseEnabled) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              headers['Authorization'] = `Bearer ${session.access_token}`;
            }
          }

          const response = await fetch('/api/groq/transcribe', {
            method: 'POST',
            headers,
            body: formData
          });

          if (response.ok) {
            const data = await response.json();
            if (data.text) {
              handleSend(data.text, [attachment]);
              return;
            }
          }
        } catch (err) {
          console.error('Transcription error:', err);
        }

        handleSend('Sent a voice message', [attachment]);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('Error handling audio:', err);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleMicContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMicSettingsPos({ x: e.clientX, y: e.clientY });
    setShowMicSettings(true);
  };

  const processFiles = useCallback(async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        let type: 'image' | 'audio' | 'file' = 'file';
        if (file.type.startsWith('image/')) type = 'image';
        if (file.type.startsWith('audio/')) type = 'audio';
        setAttachments(prev => [...prev, { type, url, name: file.name }]);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) await processFiles(e.target.files);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files.length > 0) await processFiles(e.dataTransfer.files);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.items || [])
      .map(item => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (files.length > 0) await processFiles(files);
  };

  const handleAddImageToWorkspace = useCallback((url: string) => {
    if (!activeEntityId || activeEntityId === 'dashboard') return;
    const newBlock: EditorBlock = { id: generateId(), type: 'image', content: '', mediaUrl: url, mediaWidth: 4, mediaCaption: 'AI Generated', align: 'left' };
    const entity = useStore.getState().entities.find(e => e.id === activeEntityId);
    if (entity && (entity.type === 'note' || entity.type === 'mixed')) {
      updateEntityContent(entity.id, [...(entity.content || []), newBlock]);
    }
  }, [activeEntityId, updateEntityContent]);

  return (
    <>
      {!isAIAssistantOpen && (
        <div className="fixed bottom-8 right-8 z-[90]">
          <button
            onClick={toggleAIAssistant}
            onMouseEnter={() => setIsHoveringToggle(true)}
            onMouseLeave={() => setIsHoveringToggle(false)}
            className="w-18 h-18 rounded-[var(--radius-medium)] bg-accent text-white flex items-center justify-center group"
          >
            <AIAvatar className="w-7 h-7" />
          </button>
        </div>
      )}

      {showMicSettings && (
        <>
          <div
            className="fixed inset-0 z-[1000]"
            onClick={() => setShowMicSettings(false)}
            onContextMenu={(e) => { e.preventDefault(); setShowMicSettings(false); }}
          />
          <div
            className="fixed z-[1001] bg-[#121213] border border-white/10 rounded-2xl p-3 w-64 shadow-2xl animate-in fade-in zoom-in-95"
            style={{
              left: Math.min(micSettingsPos.x, window.innerWidth - 270),
              top: Math.min(micSettingsPos.y - 200, window.innerHeight - 250)
            }}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Mic Settings</span>
              <Settings2 strokeWidth={2} className="w-3 h-3 text-muted-foreground/40" />
            </div>

            <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-hide mb-3">
              {microphones.length === 0 ? (
                <div className="text-[11px] text-muted-foreground/30 py-4 text-center">No microphones found</div>
              ) : (
                <div className="space-y-0.5">
                  {microphones.map(mic => (
                    <button
                      key={mic.deviceId}
                      onClick={() => { setSelectedMicId(mic.deviceId); setShowMicSettings(false); }}
                      className={clsx(
                        "w-full px-3 py-2 rounded-xl text-left text-[11px] flex items-center justify-between group",
                        selectedMicId === mic.deviceId
                          ? "bg-accent/10 text-accent font-bold"
                          : "text-muted-foreground/60 hover:text-foreground hover:bg-hover"
                      )}
                    >
                      <span className="truncate flex-1">{mic.label || `Microphone ${mic.deviceId.slice(0, 4)}`}</span>
                      {selectedMicId === mic.deviceId && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-white/5 space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[9px] font-black uppercase text-muted-foreground/40">Input Test</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <div
                      key={i}
                      className={clsx(
                        "w-1 h-3 rounded-full",
                        (volume * 8) >= i ? "bg-accent" : "bg-white/5"
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div
        ref={containerRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPaste={handlePaste}
        className={clsx(
          "flex flex-col overflow-hidden bg-sidebar",
          actualExtended
            ? "relative w-full h-full slide-in-from-right-4"
            : "fixed bottom-6 right-6 w-[380px] h-[680px] max-h-[calc(100vh-3rem)] z-[100] bg-sidebar rounded-[var(--radius-big)] border border-[var(--bone-10)] hover:border-[var(--bone-30)] transition-colors duration-300 overflow-hidden zoom-in-95 slide-in-from-bottom-4"
        )}
        style={{ display: isAIAssistantOpen ? 'flex' : 'none' }}
      >
        {isDragging && (
          <div className="absolute inset-x-5 bottom-32 z-[110] pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-accent/15 backdrop-blur-xl border border-accent/30 p-4 rounded-3xl flex items-center justify-center gap-4 shadow-2xl">
              <div className="w-10 h-10 rounded-2xl bg-accent text-white flex items-center justify-center">
                <ImageIcon strokeWidth={2.5} className="w-5 h-5" />
              </div>
              <p className="text-[13px] font-bold text-white tracking-tight pr-4">Drop files to attach</p>
            </div>
          </div>
        )}

        <div className="py-4 border-b border-white/5 flex items-center justify-between shrink-0 pl-7 pr-7">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2.5">
              <h1 className="text-[26px] font-semibold tracking-tight text-foreground leading-none" style={{ fontFamily: '"Crimson Pro", serif' }}>
                AI Agent
              </h1>
              <div className={clsx("w-1.5 h-1.5 rounded-full mt-1 shadow-[0_0_8px_rgba(34,197,94,0.4)]", isMounted ? "bg-[#22C55E]" : "bg-[#EF4444]")} />
            </div>
            <p className="text-[10px] font-bold text-bone-30 tracking-[0.1em] uppercase mt-1">
              Flowr AI
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleAIAssistantExtended}
              className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-small)] text-muted-foreground hover:text-foreground hover:bg-[var(--bone-6)]"
            >
              {isAIAssistantExtended ? <PanelLeft strokeWidth={2} className="w-5 h-5" /> : <PanelRight strokeWidth={2} className="w-5 h-5 rotate-180" />}
            </button>
            <button
              onClick={() => openModal({ kind: 'settings', tab: 'security' })}
              className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-small)] text-muted-foreground hover:text-foreground hover:bg-[var(--bone-6)]"
            >
              <Key strokeWidth={2} className="w-5 h-5" />
            </button>
            <button
              onClick={clearAIChat}
              className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-small)] text-muted-foreground hover:text-foreground hover:bg-[var(--bone-6)]"
            >
              <Trash2 strokeWidth={2} className="w-5 h-5" />
            </button>
            <button
              onClick={() => setAIAssistantOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-small)] text-muted-foreground hover:text-foreground hover:bg-[var(--bone-6)]"
            >
              <X strokeWidth={2} className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div
          ref={messagesContainerRef}
          className={clsx(
            "flex-1 px-5 py-5 space-y-2 flex flex-col",
            aiMessages.length === 0 && "pb-0",
            isScrollable ? "overflow-y-auto scrollbar-thin" : "overflow-y-hidden"
          )}
          style={{ overflowAnchor: 'auto' }}
        >
          {aiMessages.length === 0 && !isAILoading && (
            <div className="flex-1 flex flex-col justify-end text-center pb-5 min-h-0">
              <div className="flex items-center justify-center gap-6">
                <StarIcon className="w-8 h-8" style={{ color: '#E09952', fill: '#E09952' }} />
                <p className="text-[26px] font-medium text-bone-40 leading-tight tracking-tight font-[family-name:var(--font-display)]">
                  How can I help you today?
                </p>
              </div>
            </div>
          )}
          {aiMessages.filter(m => m.role === 'user' || m.role === 'assistant').map((msg, idx, filtered) => (
            <ChatMessage
              key={msg.id || `msg-${idx}`}
              msg={msg}
              isAILoading={idx === filtered.length - 1 ? isAILoading : false}
              isLast={idx === filtered.length - 1}
              scrollToBottom={scrollToBottom}
              handleAddImageToWorkspace={handleAddImageToWorkspace}
              onRegenerate={() => {
                const lastUserMsg = [...filtered.slice(0, idx + 1)].reverse().find(m => m.role === 'user');
                if (lastUserMsg) handleSend(lastUserMsg.content, lastUserMsg.attachments);
              }}
            />
          ))}
          <div ref={messagesEndRef} className={clsx("shrink-0", aiMessages.length > 0 ? "h-6" : "h-0")} />
        </div>

        <div className={clsx("relative h-0 overflow-visible z-[100]", !isScrollable && "hidden")}>
          <div className="absolute bottom-6 right-6 flex flex-col gap-1.5 pointer-events-none">
            <button
              onClick={() => {
                const container = messagesContainerRef.current;
                if (!container) return;
                const userMsgs = Array.from(container.querySelectorAll('.items-end'));
                if (userMsgs.length > 0) {
                  const lastUserMsg = userMsgs[userMsgs.length - 1];
                  lastUserMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }}
              className="w-7 h-7 rounded-full bg-[var(--bone-5)] backdrop-blur-xl border border-white/10 text-bone-60 hover:text-bone-100 hover:bg-[var(--bone-15)] hover:border-white/20 flex items-center justify-center pointer-events-auto transition-all shadow-2xl hover:scale-110 active:scale-95 group/nav"
              title="Jump to your last message"
            >
              <ChevronUp strokeWidth={2.5} className="w-3.5 h-3.5 group-hover/nav:-translate-y-0.5 transition-transform" />
            </button>
            <button
              onClick={() => scrollToBottom('smooth')}
              className="w-7 h-7 rounded-full bg-[var(--bone-5)] backdrop-blur-xl border border-white/10 text-bone-60 hover:text-bone-100 hover:bg-[var(--bone-15)] hover:bg-white/5 hover:border-white/20 flex items-center justify-center pointer-events-auto transition-all shadow-xl hover:scale-110 active:scale-95 group/nav"
              title="Scroll to bottom"
            >
              <ChevronUp strokeWidth={2.5} className="w-3.5 h-3.5 rotate-180 group-hover/nav:translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {attachments.length > 0 && (
          <div className="px-5 py-2 bg-background border-t border-white/5 flex gap-2 overflow-x-auto scrollbar-hide">
            {attachments.map((att, i) => (
              <div key={`pending-att-${i}`} className="relative group shrink-0">
                <div className={clsx(
                  "rounded-[var(--radius-small)] overflow-hidden border border-[var(--bone-10)] bg-white/5 flex items-center justify-center",
                  att.type === 'audio' ? "w-auto h-auto" : "w-12 h-12"
                )}>
                  {att.type === 'image' ? (
                    <img src={att.url} className="w-full h-full object-cover" />
                  ) : att.type === 'audio' ? (
                    <ChatAudioPlayer
                      url={att.url}
                      name={att.name}
                      isPending
                      onRemove={() => setAttachments(p => p.filter((_, idx) => idx !== i))}
                    />
                  ) : (
                    <Paperclip strokeWidth={2} className="w-4 h-4 text-accent" />
                  )}
                </div>
                {att.type !== 'audio' && (
                  <button
                    onClick={() => setAttachments(p => p.filter((_, idx) => idx !== i))}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg"
                  >
                    <X strokeWidth={2} className="w-2 h-2" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="px-4 pb-8 pt-4 shrink-0 bg-sidebar border-t border-[var(--bone-10)]">
          <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} />

          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-[var(--bone-6)] border border-[var(--bone-6)] rounded-xl px-4 min-h-[48px] h-auto py-3 focus-within:border-accent/30 overflow-hidden">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                }}
                placeholder="Ask the Agent to do anything..."
                rows={1}
                className="flex-1 bg-transparent text-foreground text-[13px] placeholder:text-muted-foreground/30 focus:outline-none resize-none leading-relaxed py-0 custom-scrollbar"
                style={{ height: 'auto', maxHeight: '120px', overflowY: 'auto' }}
              />
              {isAILoading ? (
                <button
                  onClick={stopAIGeneration}
                  className="ml-2 w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-red-400/10 text-red-500 hover:bg-red-400/20"
                  title="Stop generation"
                >
                  <Square strokeWidth={3} className="w-3 h-3 fill-current" />
                </button>
              ) : (!input.trim() && attachments.length === 0) ? (
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  {isRecording && (
                    <div className="flex items-center gap-1.5 mr-3 animate-in fade-in slide-in-from-right-2">
                      {[...Array(8)].map((_, i) => (
                        <div
                          key={i}
                          className="w-0.5 bg-red-500 rounded-full animate-pulse"
                          style={{
                            height: `${10 + Math.random() * volume * 100}%`,
                            animationDelay: `${i * 100}ms`
                          }}
                        />
                      ))}
                      <span className="text-[10px] font-bold text-red-500/60 uppercase tracking-widest ml-1">REC</span>
                    </div>
                  )}
                  <button
                    onMouseDown={(e) => { if (e.button === 0) startRecording(); }}
                    onMouseUp={() => stopRecording()}
                    onMouseLeave={() => { if (isRecording) stopRecording(); }}
                    onContextMenu={handleMicContextMenu}
                    className={clsx(
                      "w-7 h-7 rounded-full flex items-center justify-center relative shrink-0",
                      isRecording
                        ? "bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                        : "text-muted-foreground/50 hover:text-foreground hover:bg-hover"
                    )}
                    title="Hold to record (Max 60s) — Right-click for settings"
                  >
                    <Mic strokeWidth={2} className={clsx("w-4 h-4", isRecording && "animate-pulse")} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleSend()}
                  className="ml-2 w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-muted-foreground/50 hover:text-foreground"
                >
                  <Send strokeWidth={2} className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3 px-1 relative">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1 px-1.5 text-bone-60 hover:text-foreground"
              title="Add media"
            >
              <Plus strokeWidth={2} className="w-4 h-4" />
            </button>

            <button
              onClick={() => setInput(p => p + '@')}
              className="p-1 px-1.5 text-bone-60 hover:text-foreground"
              title="Mention page or workspace"
            >
              <span className="text-[14px] font-bold leading-none">@</span>
            </button>

            <button
              onClick={() => setAgentEnabled(!agentEnabled)}
              className={clsx(
                "flex items-center gap-2 px-4 h-8 rounded-full border",
                agentEnabled
                  ? "bg-bone-6 border-bone-6 text-bone-100 font-semibold"
                  : "bg-transparent border-transparent text-bone-60 hover:text-foreground hover:bg-hover"
              )}
            >
              <span className="text-[11px] tracking-tight">Agent</span>
            </button>

            <div className="flex items-center gap-2 ml-auto min-w-0">
              <div className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-bone-6 border border-bone-6 text-[11px] font-semibold text-bone-60">
                <StarIcon className="w-3 h-3 text-bone-60" />
                <span>Flowr AI</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export const AIAssistant = memo(AIAssistantComponent);
