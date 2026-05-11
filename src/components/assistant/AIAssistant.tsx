"use client";

import { useStore } from '@/data/store';
import type { AIAttachment, EditorBlock } from '@/data/store';
import { generateId } from '@/data/store';
import type { BotMode } from '@/data/store.types';
import { X, Send, Trash2, Key, PanelRight, PanelLeft, Plus, ChevronUp, Image as ImageIcon, Paperclip, Square, Mic, Settings2, Slash, Globe, FileText, CheckSquare, Cloud, Coins, TrendingUp, Eraser, Command, ArrowRight, Frame, Layers, Zap, AtSign, SquareSlash, Telescope, Terminal, Brain, Sparkles } from 'lucide-react';
import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { StarIcon } from './components/StarIcon';
import { AIAvatar } from './components/AIAvatar';
import { ChatAudioPlayer } from './components/ChatAudioPlayer';
import { ChatMessage } from './components/ChatMessage';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import clsx from 'clsx';

const ContextMeter = ({ usage, limit, threshold = 0.8, size = 30 }: { usage: number; limit: number, threshold?: number, size?: number }) => {
  const percentage = Math.round((usage / limit) * 100);
  const radius = (size / 2) - 2.5;
  const center = size / 2;
  const strokeDasharray = 2 * Math.PI * radius;
  const strokeDashoffset = strokeDasharray * (1 - Math.min(usage / limit, 1));

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-bone-6/30" />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          className={clsx(
            "transition-all duration-500",
            (usage / limit) > threshold ? "text-white/60" : "text-bone-100"
          )}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

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
  const aiApiKey = useStore(state => state.aiApiKey);
  const aiSessionContext = useStore(state => state.aiSessionContext);
  const fetchAISessionContext = useStore(state => state.fetchAISessionContext);
  const compactAIChat = useStore(state => state.compactAIChat);

  const activeMode = useStore(state => state.activeMode)
  const setActiveMode = useStore(state => state.setActiveMode)
  const activeIntentTag = useStore(state => state.activeIntentTag)
  const setActiveIntentTag = useStore(state => state.setActiveIntentTag)
  const activeReplyMessage = useStore(state => state.activeReplyMessage)
  const setReplyMessage = useStore(state => state.setReplyMessage)
  const thinkingEnabled = useStore(state => state.thinkingEnabled)
  const setThinkingEnabled = useStore(state => state.setThinkingEnabled)
  const advisorEnabled = useStore(state => state.advisorEnabled)
  const setAdvisorEnabled = useStore(state => state.setAdvisorEnabled)
  const [showModeMenu, setShowModeMenu] = useState(false)

  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setIsHoveringToggle] = useState(false);
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
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [isCompacting, setIsCompacting] = useState(false);

  const MODE_OPTIONS: { key: BotMode; label: string; description: string }[] = [
    { key: 'default', label: 'Default', description: 'Fast, universal' },
    { key: 'pro', label: 'Pro', description: 'Max precision' },
  ]

  const actualExtended = isFloating ? false : isAIAssistantExtended;
  const sessionId = activeEntityId || 'global';

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isAIAssistantOpen) {
      fetchAISessionContext(sessionId);
    }
  }, [isAIAssistantOpen, sessionId, fetchAISessionContext]);

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

      await sendAIMessage(finalContent, finalAttachments);
      // Clear intent tag after message is dispatched
      setActiveIntentTag(null);
      // Re-fetch context after message to get updated token usage
      setTimeout(() => fetchAISessionContext(sessionId), 1000);
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
          if (aiApiKey) formData.append('aiApiKey', aiApiKey);

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

  const CHAIN_TAGS = ['/search', '/research', '/code', '/image'];

  const commands = [
    { id: 'image', label: 'Generate Image', icon: <ImageIcon strokeWidth={2} className="w-3.5 h-3.5" />, description: 'Create an image from text', prefix: '/image ' },
    { id: 'search', label: 'Web Search', icon: <Globe strokeWidth={2} className="w-3.5 h-3.5" />, description: 'Search the internet for info', prefix: '/search ' },
    { id: 'research', label: 'Deep Research', icon: <Telescope strokeWidth={2} className="w-3.5 h-3.5" />, description: 'Research using Perplexity and Tavily', prefix: '/research ' },
    { id: 'code', label: 'Code', icon: <Terminal strokeWidth={2} className="w-3.5 h-3.5" />, description: 'Use the coding chain for programming tasks', prefix: '/code ' },
    { id: 'note', label: 'Create Note', icon: <FileText strokeWidth={2} className="w-3.5 h-3.5" />, description: 'Create a new note in workspace', prefix: '/note ' },
    { id: 'canvas', label: 'Create Canvas', icon: <Frame strokeWidth={2} className="w-3.5 h-3.5" />, description: 'Create a new drawing canvas', prefix: '/canvas ' },
    { id: 'split', label: 'Create Split Page', icon: <Layers strokeWidth={2} className="w-3.5 h-3.5" />, description: 'Create a new mixed split page', prefix: '/split ' },
    { id: 'task', label: 'Add Task', icon: <CheckSquare strokeWidth={2} className="w-3.5 h-3.5" />, description: 'Add a task to your inbox', prefix: '/task ' },
    { id: 'mention', label: 'Mention', icon: <AtSign strokeWidth={2} className="w-3.5 h-3.5" />, description: 'Mention page or workspace', prefix: '@' },
    { id: 'clear', label: 'Clear Chat', icon: <Eraser strokeWidth={2} className="w-3.5 h-3.5" />, description: 'Wipe conversation history', action: () => { clearAIChat(); setInput(''); } },
  ];

  const filteredCommands = input.startsWith('/')
    ? commands.filter(c => c.label.toLowerCase().includes(input.slice(1).toLowerCase()) || c.id.includes(input.slice(1).toLowerCase()))
    : [];

  useEffect(() => {
    if (input.startsWith('/')) {
      setShowCommandMenu(true);
      setActiveCommandIndex(0);
    } else {
      setShowCommandMenu(false);
    }
  }, [input]);

  const handleCommandSelect = (cmd: typeof commands[0]) => {
    if (cmd.prefix) {
      // Set activeIntentTag for chain-related commands
      const tag = `/${cmd.id}`;
      if (CHAIN_TAGS.includes(tag)) {
        setActiveIntentTag(tag);
      }
      setInput(cmd.prefix);
      textareaRef.current?.focus();
    } else if (cmd.action) {
      cmd.action();
    }
    setShowCommandMenu(false);
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
            className="flex items-center justify-center group hover:scale-110 active:scale-95"
          >
            <AIAvatar className="w-12 h-12" />
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
            className="fixed z-[1001] bg-[var(--color-panel)] backdrop-blur-2xl rounded-[16px] p-4 w-72 border border-white/10 animate-in fade-in zoom-in-95 slide-in-from-bottom-2"
            style={{
              left: Math.min(micSettingsPos.x, window.innerWidth - 300),
              top: Math.min(micSettingsPos.y - 220, window.innerHeight - 280)
            }}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-bone-60">Mic Settings</span>
              <Settings2 strokeWidth={2} className="w-3 h-3 text-bone-60" />
            </div>

            <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-hide mb-3">
              {microphones.length === 0 ? (
                <div className="text-[11px] text-bone-60 py-4 text-center tracking-wide">No microphones found</div>
              ) : (
                <div className="space-y-0.5">
                  {microphones.map(mic => (
                    <button
                      key={mic.deviceId}
                      onClick={() => { setSelectedMicId(mic.deviceId); setShowMicSettings(false); }}
                      className={clsx(
                        "w-full px-3 py-2 rounded-xl text-left text-[11px] flex items-center justify-between group tracking-wide",
                        selectedMicId === mic.deviceId
                          ? "bg-white/10 text-bone-100 font-bold"
                          : "text-muted-foreground/60 hover:text-foreground hover:bg-hover"
                      )}
                    >
                      <span className="truncate flex-1">{mic.label || `Microphone ${mic.deviceId.slice(0, 4)}`}</span>
                      {selectedMicId === mic.deviceId && <div className="w-1.5 h-1.5 rounded-full bg-bone-100" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[var(--bone-6)] space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[9px] font-bold uppercase text-bone-60">Input Test</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <div
                      key={i}
                      className={clsx(
                        "w-1 h-3 rounded-full",
                        (volume * 8) >= i ? "bg-bone-100" : "bg-white/5"
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
            ? "relative w-full h-full"
            : "fixed bottom-6 right-6 w-[380px] h-[680px] max-h-[calc(100vh-3rem)] z-[100] bg-sidebar rounded-[var(--radius-big)] border border-[var(--bone-12)] overflow-hidden zoom-in-95 slide-in-from-bottom-4"
        )}
        style={{ display: isAIAssistantOpen ? 'flex' : 'none' }}
      >
        {isDragging && (
          <div className="absolute inset-x-5 bottom-32 z-[110] pointer-events-none animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-3xl flex items-center justify-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-white/20 text-bone-100 flex items-center justify-center">
                <ImageIcon strokeWidth={2} className="w-5 h-5" />
              </div>
              <p className="text-[13px] font-bold text-white tracking-tight pr-4">Drop files to attach</p>
            </div>
          </div>
        )}

        <div className="py-3 border-b border-[var(--bone-6)] flex items-center justify-between shrink-0 px-6">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2.5">
              <h1 className="text-[28px] font-semibold tracking-tight text-foreground leading-none" style={{ fontFamily: '"Crimson Text", serif' }}>
                Agent
              </h1>
              <div className={clsx("w-1 h-1 rounded-full mt-2", isMounted ? "bg-[#22C55E]" : "bg-[#EF4444]")} />
            </div>
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
            "flex-1 px-6 py-4 space-y-2 flex flex-col",
            aiMessages.length === 0 && "pb-0",
            isScrollable ? "overflow-y-auto overflow-x-hidden scrollbar-thin" : "overflow-y-hidden overflow-x-hidden"
          )}
          style={{ overflowAnchor: 'auto' }}
        >
          {aiMessages.length === 0 && !isAILoading && (
            <div className="flex-1 flex flex-col justify-end text-center pb-5 min-h-0">
              <div className="flex items-center justify-center gap-6">
              <StarIcon className="w-8 h-8" style={{ color: 'var(--bone-100)', fill: 'var(--bone-100)' }} />
                <p className="text-[26px] font-medium text-bone-60 leading-tight tracking-tight font-[family-name:var(--font-display)]">
                  How can I help you today?
                </p>
              </div>
            </div>
          )}
          {aiMessages.filter(m => m.role === 'user' || m.role === 'assistant').map((msg, idx, filtered) => (
            <div key={msg.id || `msg-${idx}`} id={`msg-row-${msg.id}`} className="w-full">
              <ChatMessage
                msg={msg}
                isAILoading={idx === filtered.length - 1 ? isAILoading : false}
                isLast={idx === filtered.length - 1}
                scrollToBottom={scrollToBottom}
                handleAddImageToWorkspace={handleAddImageToWorkspace}
                onRegenerate={() => {
                  const lastUserMsg = [...filtered.slice(0, idx + 1)].reverse().find(m => m.role === 'user');
                  if (lastUserMsg) handleSend(lastUserMsg.content, lastUserMsg.attachments);
                }}
                onReply={setReplyMessage}
              />
            </div>
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
              className="w-7 h-7 rounded-[8px] bg-[var(--bone-6)] backdrop-blur-xl text-bone-60 hover:text-bone-100 hover:bg-[var(--bone-15)] flex items-center justify-center pointer-events-auto hover:scale-110 active:scale-95 group/nav"
              title="Jump to your last message"
            >
              <ChevronUp strokeWidth={2} className="w-3.5 h-3.5 group-hover/nav:-translate-y-0.5" />
            </button>
            <button
              onClick={() => scrollToBottom('smooth')}
              className="w-7 h-7 rounded-[8px] bg-[var(--bone-6)] backdrop-blur-xl text-bone-60 hover:text-bone-100 hover:bg-[var(--bone-15)] flex items-center justify-center pointer-events-auto hover:scale-110 active:scale-95 group/nav"
              title="Scroll to bottom"
            >
              <ChevronUp strokeWidth={2} className="w-3.5 h-3.5 rotate-180 group-hover/nav:translate-y-0.5" />
            </button>
          </div>
        </div>


        <div className="px-6 pb-6 pt-3 shrink-0 bg-sidebar border-t border-[var(--bone-6)] relative">
          <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} />

          {/* Unified Message Bar Container */}
          <div className="bg-[var(--bone-6)] border border-white/5 rounded-[16px] p-3 flex flex-col relative focus-within:border-white/10 transition-colors">
            {activeIntentTag && (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-[10px] bg-white/10 border border-white/20 w-fit mb-2 animate-in fade-in slide-in-from-bottom-1">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-bone-100" />
                  <span className="text-[10px] font-bold text-bone-100 uppercase tracking-wider">{activeIntentTag.replace(/^!/, '').replace(/_/g, ' ')}</span>
                </div>
                <button 
                  onClick={() => useStore.getState().setActiveIntentTag(null)}
                  className="ml-1 p-0.5 hover:bg-white/20 rounded-md text-bone-100 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            {attachments.length > 0 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-1 border-b border-white/5">
                {attachments.map((att, i) => (
                  <div key={`pending-att-${i}`} className="relative group shrink-0">
                    <div className={clsx(
                      "rounded-[10px] overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center",
                      att.type === 'audio' ? "w-auto h-auto" : "w-11 h-11"
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
                        <Paperclip strokeWidth={2} className="w-4 h-4 text-bone-60" />
                      )}
                    </div>
                    {att.type !== 'audio' && (
                      <button
                        onClick={() => setAttachments(p => p.filter((_, idx) => idx !== i))}
                        className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 z-10 transition-all hover:scale-110"
                      >
                        <X strokeWidth={2} className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {activeReplyMessage && (
              <div
                onClick={() => {
                  const targetRow = document.getElementById(`msg-row-${activeReplyMessage.id}`);
                  if (targetRow) {
                    targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    targetRow.classList.remove('pulse-highlight');
                    void targetRow.offsetWidth; // Trigger reflow
                    targetRow.classList.add('pulse-highlight');
                  }
                }}
                className="flex items-center justify-between bg-white/5 rounded-[10px] px-3 py-1.5 mb-1 border-l-2 border-white/30 gap-3 animate-fade-in shrink-0 cursor-pointer hover:bg-white/10 transition-colors"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-[9px] font-bold uppercase tracking-[0.05em] text-bone-60">
                    Replying to {activeReplyMessage.role === 'user' ? 'You' : 'AI'}
                  </span>
                  <span className="text-[11px] text-[var(--bone-60)] truncate font-medium">
                    {activeReplyMessage.content?.replace(new RegExp('<think>[\\\\s\\\\S]*?</think>', 'g'), '') || 'Attachment'}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setReplyMessage(null);
                  }}
                  className="p-1 rounded-md hover:bg-white/10 text-[var(--bone-40)] hover:text-white transition-colors shrink-0"
                >
                  <X strokeWidth={2} className="w-3 h-3" />
                </button>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (showCommandMenu && filteredCommands.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActiveCommandIndex(i => Math.min(i + 1, filteredCommands.length - 1));
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActiveCommandIndex(i => Math.max(i - 1, 0));
                    return;
                  }
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    handleCommandSelect(filteredCommands[activeCommandIndex]);
                    return;
                  }
                  if (e.key === 'Escape') {
                    setShowCommandMenu(false);
                    return;
                  }
                }
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 120) + 'px';
              }}
              placeholder="Ask Flowr AI"
              rows={1}
              className="w-full bg-transparent text-foreground text-[14px] placeholder:text-bone-60 focus:outline-none resize-none leading-relaxed px-1 custom-scrollbar tracking-wide"
              style={{ height: 'auto', maxHeight: '120px', overflowY: 'auto' }}
            />

            {/* Action Bar */}
            <div className="flex items-center justify-between mt-1">
              {/* Left Actions */}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-[8px] text-bone-60 hover:text-foreground hover:bg-white/5 transition-all"
                  title="Add media"
                >
                  <Plus strokeWidth={2} className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    if (!input.startsWith('/')) {
                      setInput('/');
                      textareaRef.current?.focus();
                    } else {
                      setShowCommandMenu(!showCommandMenu);
                    }
                  }}
                  className={clsx(
                    "flex items-center gap-1.5 px-2 py-1 rounded-[8px] transition-all",
                    showCommandMenu ? "bg-white/10 text-foreground" : "text-bone-60 hover:text-foreground hover:bg-white/5"
                  )}
                  title="Commands and tools"
                >
                  <SquareSlash strokeWidth={2} className="w-4 h-4" />
                  <span className="text-[11px] font-bold uppercase tracking-widest pt-0.5">Tools</span>
                </button>
              </div>

              {/* Right Actions */}
              <div className="flex items-center gap-1.5">
                {/* Mode selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowModeMenu(v => !v)}
                    className={clsx(
                      "flex items-center gap-1.5 px-2 py-1 rounded-[8px] border transition-all duration-200",
                      showModeMenu
                        ? "bg-white/10 border-white/20 text-bone-100"
                        : "border-white/10 text-bone-60 hover:text-bone-100 hover:border-white/20"
                    )}
                  >
                    <span className="hidden sm:inline text-[11px] font-bold uppercase tracking-widest pt-0.5">{MODE_OPTIONS.find(m => m.key === activeMode)?.label}</span>
                    <ChevronUp strokeWidth={2} className={clsx("w-3 h-3 transition-transform duration-300", showModeMenu ? "rotate-180 opacity-100" : "opacity-40")} />
                  </button>

                  {showModeMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-[140]"
                        onClick={() => setShowModeMenu(false)}
                      />
                      <div className="absolute bottom-full mb-2 right-0 z-[150] bg-[var(--color-panel)] border border-white/10 rounded-[16px] overflow-hidden min-w-[160px] backdrop-blur-3xl animate-in fade-in zoom-in-95 slide-in-from-bottom-2">
                        <div className="p-1.5 space-y-0.5">
                          {MODE_OPTIONS.map(opt => (
                            <button
                              key={opt.key}
                              onClick={() => { setActiveMode(opt.key); setShowModeMenu(false) }}
                              className={clsx(
                                'w-full flex items-center px-4 py-2.5 rounded-[10px] text-xs transition-all duration-200 text-left group',
                                activeMode === opt.key
                                  ? 'bg-white/10 text-bone-100 font-bold'
                                  : 'text-bone-80 hover:bg-white/5 hover:text-bone-100'
                              )}
                            >
                              <div className="flex flex-col">
                                <p className="font-bold tracking-tight">{opt.label}</p>
                                <p className="text-bone-60 text-[9px] uppercase tracking-wider font-bold opacity-60">{opt.description}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                        <div className="border-t border-white/5 mt-1 pt-1 px-2 pb-1 space-y-0.5">
                          <button
                            onClick={() => setThinkingEnabled(!thinkingEnabled)}
                            className={clsx(
                              'w-full flex items-center gap-3 px-2 py-2 rounded-[10px] text-xs transition-all duration-200',
                              thinkingEnabled
                                ? 'bg-white/10 text-bone-100 font-bold'
                                : 'text-bone-60 hover:bg-white/5 hover:text-bone-100'
                            )}
                          >
                            <Brain className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                            <div className="flex flex-col items-start">
                              <span className="text-[11px] font-bold">Thinking</span>
                              <span className="text-[10px] opacity-60">{thinkingEnabled ? 'On — reasons before answering' : 'Off'}</span>
                            </div>
                            <div className={clsx(
                              'ml-auto w-7 h-4 rounded-full transition-all duration-200 flex items-center',
                              thinkingEnabled ? 'bg-white/30 justify-end' : 'bg-white/10 justify-start'
                            )}>
                              <div className="w-3 h-3 rounded-full bg-white mx-0.5" />
                            </div>
                          </button>
                          <button
                            onClick={() => setAdvisorEnabled(!advisorEnabled)}
                            className={clsx(
                              'w-full flex items-center gap-3 px-2 py-2 rounded-[10px] text-xs transition-all duration-200',
                              advisorEnabled
                                ? 'bg-white/10 text-bone-100 font-bold'
                                : 'text-bone-60 hover:bg-white/5 hover:text-bone-100'
                            )}
                          >
                            <Sparkles className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                            <div className="flex flex-col items-start">
                              <span className="text-[11px] font-bold">Advisor</span>
                              <span className="text-[10px] opacity-60">{advisorEnabled ? 'On — asks clarifying questions' : 'Off'}</span>
                            </div>
                            <div className={clsx(
                              'ml-auto w-7 h-4 rounded-full transition-all duration-200 flex items-center',
                              advisorEnabled ? 'bg-white/30 justify-end' : 'bg-white/10 justify-start'
                            )}>
                              <div className="w-3 h-3 rounded-full bg-white mx-0.5" />
                            </div>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>





                <div className="relative group flex items-center gap-2 px-1">
                  <div className="flex items-center gap-2 z-10 cursor-help">
                    {aiSessionContext && (
                      <div className="relative w-4 h-4 flex items-center justify-center">
                        <ContextMeter
                          usage={aiSessionContext.token_usage_total}
                          limit={aiSessionContext.context_limit}
                          threshold={aiSessionContext.compaction_threshold}
                          size={16}
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[7px] font-bold text-bone-100">
                            {Math.round((aiSessionContext.token_usage_total / aiSessionContext.context_limit) * 100)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Detailed Context Tooltip */}
                  {aiSessionContext && (
                    <div className="absolute bottom-full right-0 mb-4 bg-[var(--color-panel)] p-4 rounded-[16px] opacity-0 group-hover:opacity-100 transition-all duration-200 scale-95 group-hover:scale-100 pointer-events-none border border-white/10 z-[130] backdrop-blur-3xl animate-in fade-in zoom-in-95 slide-in-from-bottom-2 min-w-[280px]">
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-[11px] font-bold text-bone-80">
                          <span className="tracking-tight">Memory Usage ({sessionId})</span>
                          <span className="text-bone-100">{Math.round((aiSessionContext.token_usage_total / aiSessionContext.context_limit) * 100)}%</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={clsx(
                              "h-full transition-all duration-1000",
                              (aiSessionContext.token_usage_total / aiSessionContext.context_limit) > aiSessionContext.compaction_threshold ? "bg-white/40" : "bg-white/20"
                            )}
                            style={{ width: `${Math.min((aiSessionContext.token_usage_total / aiSessionContext.context_limit) * 100, 100)}%` }}
                          />
                        </div>
                        <div className="flex flex-col gap-2 mb-2 shrink-0">
                          {activeIntentTag && (
                            <div className="flex items-center gap-2 px-2.5 py-1 rounded-[10px] bg-white/10 border border-white/20 w-fit animate-in fade-in slide-in-from-bottom-1">
                              <div className="flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3 text-bone-100" />
                                <span className="text-[10px] font-bold text-bone-100 uppercase tracking-wider">{activeIntentTag.replace(/^!/, '').replace(/_/g, ' ')}</span>
                              </div>
                              <button 
                                onClick={() => useStore.getState().setActiveIntentTag(null)}
                                className="ml-1 p-0.5 hover:bg-white/20 rounded-md text-bone-100 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          <p className="text-[10px] text-bone-60 font-medium">
                            {aiSessionContext.token_usage_total.toLocaleString()} / {aiSessionContext.context_limit.toLocaleString()} tokens
                          </p>
                          <p className="text-[9px] text-bone-30 opacity-60 leading-relaxed italic">
                            {(aiSessionContext.token_usage_total / aiSessionContext.context_limit) > aiSessionContext.compaction_threshold
                              ? "Memory full. Preparing to distill..."
                              : "Session history is currently clear and fast."}
                          </p>
                        </div>

                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            setIsCompacting(true);
                            await compactAIChat();
                            setIsCompacting(false);
                          }}
                          disabled={isCompacting || aiSessionContext.token_usage_total < 500}
                          className={clsx(
                            "w-full py-1.5 rounded-[8px] text-[10px] font-bold tracking-tight transition-all pointer-events-auto flex items-center justify-center gap-2",
                            aiSessionContext.token_usage_total < 500
                              ? "bg-white/5 text-bone-20 cursor-not-allowed opacity-50"
                              : "bg-white/10 text-bone-100 hover:bg-white/20 active:scale-[0.98]"
                          )}
                        >
                          {isCompacting ? (
                            <>
                              <div className="w-2.5 h-2.5 border-2 border-bone-100 border-t-transparent rounded-full animate-spin" />
                              <span>Distilling...</span>
                            </>
                          ) : (
                            <>
                              <Zap strokeWidth={2} className="w-3 h-3" />
                              <span>Compact Memory</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {isAILoading ? (
                  <button
                    onClick={stopAIGeneration}
                    className="w-7 h-7 shrink-0 flex items-center justify-center rounded-[8px] bg-red-400/10 text-red-500 hover:bg-red-400/20 transition-all active:scale-90"
                    title="Stop generation"
                  >
                    <Square strokeWidth={2} className="w-2.5 h-2.5 fill-current" />
                  </button>
                ) : (!input.trim() && attachments.length === 0) ? (
                  <button
                    onMouseDown={(e) => { if (e.button === 0) startRecording(); }}
                    onMouseUp={() => stopRecording()}
                    onMouseLeave={() => { if (isRecording) stopRecording(); }}
                    onContextMenu={handleMicContextMenu}
                    className={clsx(
                      "w-7 h-7 rounded-[8px] flex items-center justify-center relative shrink-0 transition-all group/mic",
                      isRecording
                        ? "bg-red-500 text-white scale-110"
                        : clsx("text-bone-60 hover:text-foreground hover:bg-white/5", showMicSettings && "!bg-[var(--bone-15)] !text-[var(--bone-100)] !opacity-100")
                    )}
                    title="Hold to record (Max 60s) — Right-click for settings"
                  >
                    <Mic strokeWidth={2} className={clsx("w-3.5 h-3.5", isRecording && "animate-pulse")} />
                    {isRecording && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-ping" />
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => handleSend()}
                    className="w-7 h-7 shrink-0 flex items-center justify-center rounded-[8px] bg-white/10 text-bone-100 hover:bg-white/20 transition-all active:scale-90"
                  >
                    <Send strokeWidth={2} className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Command Menu Portal (Local to container) */}
            {showCommandMenu && filteredCommands.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-4 bg-[var(--color-panel)] backdrop-blur-3xl rounded-[16px] border border-white/10 overflow-hidden animate-in fade-in slide-in-from-bottom-2 z-[140] p-2">
                <div className="px-3 pt-1 pb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--bone-30)]">
                    Actions & Commands
                  </span>
                </div>
                <div className="max-h-80 overflow-y-auto scrollbar-none flex flex-col gap-[3px]">
                  {filteredCommands.map((cmd, i) => (
                    <button
                      key={cmd.id}
                      onClick={() => handleCommandSelect(cmd)}
                      onMouseEnter={() => setActiveCommandIndex(i)}
                      className={clsx(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-[12px] text-left group",
                        i === activeCommandIndex
                          ? "bg-white/10 text-foreground"
                          : "text-bone-60 hover:bg-white/5 hover:text-foreground"
                      )}
                    >
                      <div className={clsx(
                        "w-6 h-6 flex items-center justify-center shrink-0",
                        i === activeCommandIndex ? "text-bone-100" : "text-bone-60"
                      )}>
                        {cmd.icon}
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <p className="text-[13px] font-medium tracking-wide shrink-0">{cmd.label}</p>
                        {cmd.description && (
                          <p className="text-[11px] text-bone-60 opacity-80 truncate">{cmd.description}</p>
                        )}
                      </div>
                      {(cmd.prefix || i === activeCommandIndex) && (
                        <div className="flex items-center gap-0.5 shrink-0 ml-2">
                          <span className="px-1.5 py-0.5 rounded-[4px] bg-white/5 text-[10px] font-mono text-bone-60">
                            {cmd.prefix ? cmd.prefix.trim() : 'ENTER'}
                          </span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export const AIAssistant = memo(AIAssistantComponent);
