"use client";
// Force rebuild to ensure 'input' is fully replaced by 'assistantInput'


import { useStore } from '@/data/store';
import type { AIAttachment, EditorBlock } from '@/data/store';
import { generateId, blocksToMarkdown } from '@/data/store';
import type { BotMode } from '@/data/store.types';
import { X, ArrowUp, Trash2, Key, PanelRight, PanelLeft, Plus, ChevronUp, Image as ImageIcon, Paperclip, Square, Mic, Settings2, Slash, Globe, FileText, CheckSquare, Cloud, Coins, TrendingUp, Eraser, Command, ArrowRight, Frame, Zap, AtSign, SquareSlash, Telescope, Terminal, Brain, Sparkles, ExternalLink, History, Clock, MessageCircleDashed, Bookmark, Pen } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { ChatPlusMenu } from '@/components/chat/ChatPlusMenu';
import { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { StarIcon } from './components/StarIcon';
import { AIAvatar } from './components/AIAvatar';
import { ChatAudioPlayer } from './components/ChatAudioPlayer';
import { ChatMessage, getEntityIconReact } from './components/ChatMessage';
import { ChatInputEditable } from './components/ChatInputEditable';
import { ChatSkeleton } from './components/ChatSkeleton';
import { StatusTyping } from './components/StatusTyping';
import { useAuth } from '@/components/AuthProvider';
import { useDeferredLoading } from '@/hooks/use-deferred-loading';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { DEFAULT_STATUS_MESSAGES } from '@/lib/router-config';
import { Tooltip } from '@/components/layout/Tooltip';
import { Toggle } from '@/components/ui/Toggle';

const ContextMeter = ({ usage, limit, threshold = 0.8, size = 30 }: { usage: number; limit: number, threshold?: number, size?: number }) => {
  const percentage = Math.round((usage / limit) * 100);
  const radius = (size / 2) - 2.5;
  const center = size / 2;
  const strokeDasharray = 2 * Math.PI * radius;
  const strokeDashoffset = strokeDasharray * (1 - Math.min(usage / limit, 1));

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-bone-12" />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          className={cn(
            "",
            (usage / limit) > threshold ? "text-white/60" : "text-blue-400"
          )}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

const AIAssistantComponent = ({ isFloating = false, chatPageMode = false, forceVisible = false }: { isFloating?: boolean; chatPageMode?: boolean; forceVisible?: boolean }) => {
  const { resolvedTheme } = useTheme();
  const { user } = useAuth();
  const isAIAssistantOpen = useStore(state => state.isAIAssistantOpen);
  const isAIAssistantExtended = useStore(state => state.isAIAssistantExtended);
  const splitViewActive = useStore(state => state.splitViewActive);
  const toggleAIAssistant = useStore(state => state.toggleAIAssistant);
  const setAIAssistantOpen = useStore(state => state.setAIAssistantOpen);
  const toggleAIAssistantExtended = useStore(state => state.toggleAIAssistantExtended);
  const isTempChat = useStore(state => state.isTempChat);
  const pendingNewChat = useStore(state => state.pendingNewChat);
  const activeChatId = useStore(state => state.activeChatId);
  const tempChatGreeting = useStore(state => state.tempChatGreeting);
  const chatConversations = useStore(state => state.chatConversations);
  const showTempNotice = useStore(state => state.showTempNotice);
  const setShowTempNotice = useStore(state => state.setShowTempNotice);
  const saveTempChat = useStore(state => state.saveTempChat);
  const aiMessages = useStore(state => state.aiMessages);
  const stopAIGeneration = useStore(state => state.stopAIGeneration);
  const openModal = useStore(state => state.openModal);
  const sendAIMessage = useStore(state => state.sendAIMessage);
  const regenerateAIMessage = useStore(state => state.regenerateAIMessage);
  const clearAIChat = useStore(state => state.clearAIChat);
  const isAILoading = useStore(state => state.isAILoading);
  const activeEntityId = useStore(state => state.activeEntityId);
  const isTaskPanelOpen = useStore(state => state.isTaskPanelOpen);
  const activeTaskId = useStore(state => state.activeTaskId);
  const updateEntityContent = useStore(state => state.updateEntityContent);
  const aiApiKey = useStore(state => state.aiApiKey);
  const aiSessionContext = useStore(state => state.aiSessionContext);
  const fetchAISessionContext = useStore(state => state.fetchAISessionContext);
  const setAISessionContext = useStore(state => state.setAISessionContext);
  const sessionContextsMap = useStore(state => state.sessionContextsMap);
  const compactAIChat = useStore(state => state.compactAIChat);
  const entities = useStore(state => state.entities);
  const spaces = useStore(state => state.spaces);

  const activeMode = useStore(state => state.activeMode)
  const setActiveMode = useStore(state => state.setActiveMode)
  const activeReplyMessage = useStore(state => state.activeReplyMessage)
  const setReplyMessage = useStore(state => state.setReplyMessage)
  const thinkingEnabled = useStore(state => state.thinkingEnabled)
  const setThinkingEnabled = useStore(state => state.setThinkingEnabled)
  const advisorEnabled = useStore(state => state.advisorEnabled)
  const setAdvisorEnabled = useStore(state => state.setAdvisorEnabled)
  const pendingAdvisorState = useStore(state => state.pendingAdvisorState)
  const startNewChat = useStore(state => state.startNewChat);
  const startTempChat = useStore(state => state.startTempChat);
  const openChatInPage = useStore(state => state.openChatInPage);
  const loadChatConversations = useStore(state => state.loadChatConversations);
  const loadConversation = useStore(state => state.loadConversation);
  const deleteChatConversation = useStore(state => state.deleteChatConversation);
  const [showModeMenu, setShowModeMenu] = useState(false)
  const modeMenuBtnRef = useRef<HTMLButtonElement>(null)
  const [modeMenuPos, setModeMenuPos] = useState<{ bottom: number; right: number } | null>(null)

  const assistantInput = useStore(state => state.assistantInput);
  const setAssistantInput = useStore(state => state.setAssistantInput);
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
  const textareaRef = useRef<HTMLDivElement>(null);

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
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [cursorText, setCursorText] = useState('');
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const isCompacting = useStore(state => state.isCompacting);
  const recentEntityIds = useStore(state => state.recentEntityIds);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyConfirmDeleteId, setHistoryConfirmDeleteId] = useState<string | null>(null);
  const [showPlusMenu, setShowPlusMenu] = useState(false);

  const isMentionTriggered = /@[^@\s]*$/.test(cursorText) || cursorText.endsWith('@');

  const mentionSearchTerm = useMemo(() => {
    const match = cursorText.match(/@([^@\s]*)$/);
    return match ? match[1].toLowerCase() : '';
  }, [cursorText]);

  const filteredEntities = useMemo(() => {
    if (!isMentionTriggered) return [];
    let list: any[] = entities.filter(e => ['folder', 'note', 'canvas'].includes(e.type));
    
    const wsMapped = spaces.map(w => ({
      id: w.id,
      title: w.name,
      type: 'workspace' as const,
      icon: w.icon || (w.type === 'personal' ? 'User' : 'Box'),
      lastModified: w.createdAt || 0
    }));
    list = [...list, ...wsMapped];

    if (mentionSearchTerm) {
      list = list.filter(e => e.title.toLowerCase().includes(mentionSearchTerm));
    }
    
    // Sort by recentEntityIds first, then by lastModified descending
    list = [...list].sort((a, b) => {
      const idxA = recentEntityIds.indexOf(a.id);
      const idxB = recentEntityIds.indexOf(b.id);
      
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      
      return (b.lastModified || 0) - (a.lastModified || 0);
    });
    
    return list.map(ent => ({
      id: ent.id,
      title: ent.title,
      type: ent.type,
      icon: getEntityIconReact(ent.type, ent.icon),
    }));
  }, [isMentionTriggered, entities, spaces, mentionSearchTerm, recentEntityIds]);

  useEffect(() => {
    if (assistantInput.startsWith('/')) {
      setShowCommandMenu(true);
      setShowMentionMenu(false);
      setActiveCommandIndex(0);
    } else if (isMentionTriggered) {
      setShowMentionMenu(true);
      setShowCommandMenu(false);
      setActiveCommandIndex(0);
    } else {
      setShowCommandMenu(false);
      setShowMentionMenu(false);
    }
  }, [assistantInput, isMentionTriggered]);
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
  const plusMenuBtnRef = useRef<HTMLButtonElement>(null);
  const [plusMenuPos, setPlusMenuPos] = useState<{ bottom: number; left: number } | null>(null);
  const contextMeterRef = useRef<HTMLDivElement>(null);
  const [showContextTooltip, setShowContextTooltip] = useState(false);
  const [contextTooltipPos, setContextTooltipPos] = useState<{ bottom: number; right: number } | null>(null);
  const contextTooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const openContextTooltip = () => {
    if (contextTooltipTimeoutRef.current) clearTimeout(contextTooltipTimeoutRef.current);
    setShowContextTooltip(true);
  };
  const closeContextTooltip = () => {
    if (contextTooltipTimeoutRef.current) clearTimeout(contextTooltipTimeoutRef.current);
    contextTooltipTimeoutRef.current = setTimeout(() => setShowContextTooltip(false), 150);
  };
  useEffect(() => () => {
    if (contextTooltipTimeoutRef.current) clearTimeout(contextTooltipTimeoutRef.current);
  }, []);

  const showSkeleton = useDeferredLoading(isAILoading, 200);

  const MODE_OPTIONS: { key: BotMode; label: string; description: string }[] = [
    { key: 'default', label: 'Regular', description: 'Fast, universal' },
    { key: 'pro', label: 'Professional', description: 'Max precision' },
  ]

  const actualExtended = isFloating ? false : isAIAssistantExtended;
  const sessionId = activeChatId || activeEntityId || 'global';

  // Build page context string for sidebar/floating modes. Returns null on chat page
  // or when there is no active entity with content.
  const buildPageContext = (): string | null => {
    if (chatPageMode) return null;
    const state = useStore.getState();
    const entity = state.entities.find(e => e.id === activeEntityId);
    if (!entity) return null;
    let pageContent = '';
    if (entity.type === 'canvas') {
      const canvasBlocks = state.blocks.filter(b => b.canvasId === entity.id);
      pageContent = blocksToMarkdown(canvasBlocks);
    } else if (Array.isArray(entity.content) && entity.content.length > 0) {
      pageContent = blocksToMarkdown(entity.content);
    } else if (entity.type === 'folder' || entity.type === 'workspace') {
      const children = state.entities.filter(e => e.parentId === entity.id);
      if (children.length > 0) {
        pageContent = children.map(c => `- ${c.title} (${c.type})`).join('\n');
      }
    }
    return pageContent
      ? `Here is the content of the "${entity.title}" page the user is currently viewing (entity ID: ${entity.id}):\n${pageContent}`
      : `The user is viewing "${entity.title}" (entity ID: ${entity.id}) but it has no content.`;
  };

  // Local token estimate: ~4 chars per token. Mirrors the exact per-message text the
  // server builds for history in store.ts.sendAIMessage (stripHeavyMedia + digital twin
  // injection), so the count reflects every character the model actually receives —
  // base64 images stripped to a placeholder (the model never sees the raw bytes), but
  // the vision digital twin (image_description) fully counted since it's re-injected
  // into history on every follow-up turn.
  // Server-side token_usage_total only updates on compaction, so it stays at 0 until then.
  const displayedTokens = (() => {
    const summary = aiSessionContext?.distilled_summary;
    const summaryTokens = summary ? Math.ceil(summary.length / 4) : 0;

    let chars = 0;
    let imageTokens = 0;
    const filteredMsgs = aiMessages.filter(m => m.role === 'user' || m.role === 'assistant');
    const messagesToCount = summary ? filteredMsgs.slice(-5) : filteredMsgs;

    for (const m of messagesToCount) {
      let text = (m.content || '').includes('data:image/')
        ? (m.content || '').replace(/!\[.*?\]\s*\(\s*data:image\/.*?;base64,[\s\S]*?\)/g, m.image_description ? `[Image: ${m.image_description}]` : '[Image: (visual content generated)]')
        : (m.content || '');
      if (m.role === 'user' && m.image_description) {
        text = `${text}\n\n[VISION CONTEXT - DIGITAL TWIN]\n${m.image_description}`;
      } else if (m.role === 'user' && !m.image_description && m.attachments?.some(a => a.type === 'image' || a.type === 'pdf')) {
        text = `${text}\n[Image attached]`;
      }

      const imageCount = m.attachments?.filter(a => a.type === 'image' || a.type === 'pdf').length || 0;
      imageTokens += imageCount * 258;
      chars += text.length;
    }
    const pageCtx = buildPageContext();
    const pageContextTokens = pageCtx ? Math.ceil(pageCtx.length / 4) : 0;
    return summaryTokens + Math.ceil(chars / 4) + imageTokens + pageContextTokens;
  })();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isAIAssistantOpen) {
      const savedContext = sessionContextsMap[sessionId];
      setAISessionContext(savedContext || null);
      fetchAISessionContext(sessionId);
    }
  }, [isAIAssistantOpen, sessionId, fetchAISessionContext, sessionContextsMap, setAISessionContext]);

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
        requestAnimationFrame(() => {
          container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
        });
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
      if (isAIAssistantOpen || chatPageMode) {
        containerRef.current.style.display = 'flex';
        containerRef.current.style.opacity = '1';
        containerRef.current.style.transform = 'scale(1) translateY(0)';
        scrollToBottom('auto');
      } else {
        containerRef.current.style.display = 'none';
        containerRef.current.style.opacity = '0';
      }
    }
  }, [isAIAssistantOpen, chatPageMode, actualExtended, scrollToBottom]);

  const handleSend = async (overrideContent?: string, overrideAttachments?: AIAttachment[]) => {
    const finalContent = overrideContent !== undefined ? overrideContent : assistantInput.trim();
    const finalAttachments = overrideAttachments !== undefined ? overrideAttachments : [...attachments];

    if ((!finalContent && finalAttachments.length === 0) || isAILoading || isSubmitting) return;

    if (finalContent.toLowerCase() === '/clear') {
      clearAIChat();
      setAssistantInput('');
      setAttachments([]);
      return;
    }

    let pageContext: string | undefined;
    if (!chatPageMode && finalContent) {
      pageContext = buildPageContext() ?? undefined;
    }

    try {
      setIsSubmitting(true);
      const isSad = ['bad', 'error', 'stop', 'stupid', 'hate'].some(w => finalContent.toLowerCase().includes(w));
      window.dispatchEvent(new CustomEvent('ai-chat-sent', { detail: { isSad } }));

      if (overrideContent === undefined) setAssistantInput('');
      if (overrideAttachments === undefined) setAttachments([]);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';

      await sendAIMessage(finalContent, finalAttachments, pageContext);
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
      reader.onload = async (ev) => {
        const base64Url = ev.target?.result as string;
        let type: 'image' | 'audio' | 'file' | 'pdf' = 'file';
        if (file.type.startsWith('image/')) type = 'image';
        if (file.type.startsWith('audio/')) type = 'audio';
        if (file.type === 'application/pdf' || file.type === 'application/x-pdf' || file.name.toLowerCase().endsWith('.pdf')) type = 'pdf';

        const tempId = Math.random().toString(36).slice(2);

        // Add a temporary uploading object
        setAttachments(prev => [...prev, { type, url: base64Url, name: file.name, uploading: true, tempId }]);

        try {
          const res = await fetch('/api/ai/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: file.name, type, dataUrl: base64Url }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.url) {
              setAttachments(prev => prev.map(att =>
                att.tempId === tempId
                  ? { type, url: data.url, name: file.name }
                  : att
              ));
            }
          } else {
            console.error('Failed to upload attachment');
            setAttachments(prev => prev.filter(att => att.tempId !== tempId));
          }
        } catch (err) {
          console.error('Attachment upload error:', err);
          setAttachments(prev => prev.filter(att => att.tempId !== tempId));
        }
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
    if (files.length > 0) {
      e.preventDefault();
      await processFiles(files);
    }
  };

  const commands = [
    { id: 'image', label: 'Generate Image', icon: <ImageIcon strokeWidth={1.5} className="w-3.5 h-3.5" />, description: 'Create an image from text', prefix: '/image ' },
    { id: 'search', label: 'Web Search', icon: <Globe strokeWidth={1.5} className="w-3.5 h-3.5" />, description: 'Search the internet for info', prefix: '/search ' },
    { id: 'research', label: 'Deep Research', icon: <Telescope strokeWidth={1.5} className="w-3.5 h-3.5" />, description: 'Research using Perplexity and Tavily', prefix: '/research ' },
    { id: 'note', label: 'New Note', icon: <FileText strokeWidth={1.5} className="w-3.5 h-3.5" />, description: 'Create a new note in workspace', prefix: '/note ' },
    { id: 'canvas', label: 'New Canvas', icon: <Frame strokeWidth={1.5} className="w-3.5 h-3.5" />, description: 'Create a new drawing canvas', prefix: '/canvas ' },
    { id: 'task', label: 'New Task', icon: <CheckSquare strokeWidth={1.5} className="w-3.5 h-3.5" />, description: 'Add a task to your inbox', prefix: '/task ' },
    { id: 'mention', label: 'Mention', icon: <AtSign strokeWidth={1.5} className="w-3.5 h-3.5" />, description: 'Mention page or workspace', prefix: '@' },
    ...(isTempChat ? [{ id: 'clear', label: 'Clear Chat', icon: <Eraser strokeWidth={1.5} className="w-3.5 h-3.5" />, description: 'Wipe conversation history', action: () => { clearAIChat(); setAssistantInput(''); } }] : []),
  ];

  const isNewChatEmpty = chatPageMode && aiMessages.filter(m => m.role === 'user' || m.role === 'assistant').length === 0;

  const filteredCommands = assistantInput.startsWith('/')
    ? commands.filter(c => c.label.toLowerCase().includes(assistantInput.slice(1).toLowerCase()) || c.id.includes(assistantInput.slice(1).toLowerCase()))
    : [];

  const handleCommandSelect = (cmd: typeof commands[0]) => {
    if (cmd.id === 'mention') {
      setAssistantInput('@');
      setShowMentionMenu(true);
      textareaRef.current?.focus();
    } else if (cmd.prefix) {
      setAssistantInput(cmd.prefix);
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
    if (entity && entity.type === 'note') {
      updateEntityContent(entity.id, [...(entity.content || []), newBlock]);
    }
  }, [activeEntityId, updateEntityContent]);

  return (
    <>
      {/* Portaled to body: the right-panel wrapper in Shell uses transform (for the
          slide), which would otherwise make it the containing block for this fixed
          button and clip it away when no panel is open. */}
      {!isAIAssistantOpen && !chatPageMode && !splitViewActive && activeEntityId !== 'settings' && !(isTaskPanelOpen && activeTaskId) && typeof document !== 'undefined' && createPortal(
        <div className="fixed bottom-8 right-8 z-[90]">
          <button
            onClick={toggleAIAssistant}
            onMouseEnter={() => setIsHoveringToggle(true)}
            onMouseLeave={() => setIsHoveringToggle(false)}
            className="flex items-center justify-center group hover:scale-110 active:scale-95"
          >
            <AIAvatar className="w-12 h-12" />
          </button>
        </div>,
        document.body
      )}

      {showMicSettings && (
        <>
          <div
            className="fixed inset-0 z-[1000]"
            onClick={() => setShowMicSettings(false)}
            onContextMenu={(e) => { e.preventDefault(); setShowMicSettings(false); }}
          />
          <div
            className="fixed z-[1001] bg-[var(--color-panel)] backdrop-blur-2xl rounded-[16px] p-4 w-72 border border-[var(--bone-12)] "
            style={{
              left: Math.min(micSettingsPos.x, window.innerWidth - 300),
              top: Math.min(micSettingsPos.y - 220, window.innerHeight - 280)
            }}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-bone-70">Mic Settings</span>
              <Settings2 strokeWidth={2} className="w-3 h-3 text-bone-70" />
            </div>

            <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-hide mb-3">
              {microphones.length === 0 ? (
                <div className="text-[11px] text-bone-70 py-4 text-center tracking-wide">No microphones found</div>
              ) : (
                <div className="space-y-0.5">
                  {microphones.map(mic => (
                    <button
                      key={mic.deviceId}
                      onClick={() => { setSelectedMicId(mic.deviceId); setShowMicSettings(false); }}
                      className={cn(
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
                <span className="text-[9px] font-bold uppercase text-bone-70">Input Test</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <div
                      key={i}
                      className={cn(
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
        className={cn(
          "flex flex-col",
          !chatPageMode && "overflow-hidden",
          chatPageMode ? "bg-transparent" : "bg-sidebar",
          chatPageMode
            ? "relative w-full h-auto"
            : actualExtended
              ? "relative w-full h-full"
              : "fixed inset-0 w-full h-full max-h-screen z-[100] rounded-none border-none overflow-hidden zoom-in-95 md:inset-auto md:bottom-6 md:right-6 md:w-[380px] md:h-[680px] md:max-h-[calc(100vh-3rem)] md:rounded-[var(--radius-big)] md:border md:border-[var(--bone-10)]"
        )}
        style={{ display: (isAIAssistantOpen || chatPageMode || forceVisible) ? 'flex' : 'none' }}
      >
        {isDragging && (
          <div className="absolute inset-x-5 bottom-32 z-[110] pointer-events-none ">
            <div className="bg-white/10 backdrop-blur-xl border border-[var(--bone-12)] p-4 rounded-3xl flex items-center justify-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-white/20 text-bone-100 flex items-center justify-center">
                <ImageIcon strokeWidth={2} className="w-5 h-5" />
              </div>
              <p className="text-[13px] font-bold text-white tracking-tight pr-4">Drop files to attach</p>
            </div>
          </div>
        )}

        {!chatPageMode && (
          <div className="py-3 border-b border-[var(--bone-6)] flex items-center justify-between shrink-0 px-6">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2.5">
                <h1 className="text-[26px] font-medium tracking-tight text-foreground leading-none" style={{ fontFamily: '"Literata", serif', letterSpacing: '-0.01em' }}>
                  {isTempChat
                    ? 'Temporary Chat'
                    : 'Chat'}
                </h1>
                <div className={cn("w-1 h-1 rounded-full mt-2", isMounted ? "bg-[#22C55E]" : "bg-[#EF4444]")} />
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={startNewChat}
                className="btn-sidebar-utility"
                title="New chat"
              >
                <Pen strokeWidth={2} className="w-4 h-4" />
              </button>
              <button
                onClick={startTempChat}
                className={cn(
                  "btn-sidebar-utility",
                  isTempChat && "text-[var(--bone-100)] bg-[var(--app-dark)] !opacity-100"
                )}
                title="Temporary chat"
              >
                <MessageCircleDashed strokeWidth={2} className="w-4 h-4" />
              </button>
              <button
                onClick={openChatInPage}
                className="btn-sidebar-utility"
                title="Open in Chat"
              >
                <ExternalLink strokeWidth={2} className="w-4 h-4" />
              </button>
              <button
                onClick={() => setAIAssistantOpen(false)}
                className="btn-sidebar-utility"
              >
                <X strokeWidth={2} className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {!chatPageMode && (
          <div
            ref={messagesContainerRef}
            className={cn(
              "flex-1 px-6 py-4 space-y-2 flex flex-col @container",
              aiMessages.length === 0 && "pb-0",
              isScrollable ? "overflow-y-auto overflow-x-hidden scrollbar-thin" : "overflow-y-hidden overflow-x-hidden"
            )}
            style={{ overflowAnchor: 'auto' }}
          >
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

            {aiMessages.length === 0 && !isAILoading && (
              <div className="flex-1 flex flex-col justify-center text-center pb-5 min-h-0 relative isolate">
                {!chatPageMode && !isFloating && (
                  <div
                    className="absolute pointer-events-none rounded-full left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[300px] opacity-100 blur-[100px]"
                    style={{
                      backgroundColor: isTempChat
                        ? 'color-mix(in srgb, var(--bone-100) 15%, transparent)'
                        : 'color-mix(in srgb, var(--accent) 15%, transparent)',
                      zIndex: -1,
                    }}
                  />
                )}
                {isTempChat ? (
                  <div className="flex flex-col items-center gap-0 relative z-0 animate-fade-in">
                    <MessageCircleDashed className="w-10 h-10 text-[var(--bone-100)] opacity-40 mb-3" strokeWidth={1.5} />
                    <p className="text-[22px] font-normal text-[var(--bone-100)] leading-tight tracking-tight font-display mb-1">
                      {tempChatGreeting || "Write like nobody's listening."}
                    </p>
                    <p className="text-[12px] leading-relaxed text-[var(--bone-60)] max-w-xs">
                      This chat is temporary. It will disappear if you don't save it.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-0 relative z-0 animate-fade-in">
                    <AIAvatar className="w-10 h-10 opacity-100 mb-3" />
                    <p className="text-[22px] font-normal text-[var(--bone-100)] leading-tight tracking-tight font-display mb-1">
                      {getGreeting()}
                    </p>
                  </div>
                )}
              </div>
            )}
            {aiMessages.filter(m => m.role === 'user' || m.role === 'assistant').map((msg, idx, filtered) => (
              <div key={msg.id || `msg-${idx}`} id={`msg-row-${msg.id}`} className="w-full">
                <ChatMessage
                  msg={msg}
                  chatPageMode={chatPageMode}
                  isAILoading={idx === filtered.length - 1 ? isAILoading : false}
                  isLast={idx === filtered.length - 1}
                  scrollToBottom={scrollToBottom}
                  handleAddImageToWorkspace={handleAddImageToWorkspace}
                  onRegenerate={msg.role === 'assistant' && msg.id ? () => {
                    const lastUserMsg = [...filtered.slice(0, idx + 1)].reverse().find(m => m.role === 'user');
                    if (lastUserMsg && msg.id) regenerateAIMessage(msg.id, lastUserMsg.content ?? '', lastUserMsg.attachments);
                  } : undefined}
                  onReply={setReplyMessage}
                  compact={true}
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
                    style={{ fontFamily: '"Literata"', fontWeight: 400, fontSize: '13px', letterSpacing: '-0.01em' }}
                  />
                </div>
              </div>
            )}

            {showSkeleton && (
              <div className="w-full pb-2">
                <ChatSkeleton />
              </div>
            )}

            <div ref={messagesEndRef} className={cn("shrink-0", (aiMessages.length > 0 || showSkeleton) ? "h-24" : "h-0")} />
          </div>
        )}

        <div className={cn("relative h-0 overflow-visible z-[100]", !isScrollable && "hidden")}>
          <div className="absolute bottom-6 right-6 flex flex-col gap-1.5 pointer-events-none">
            <Tooltip content="Jump to your last message">
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
                className="w-7 h-7 rounded-[8px] bg-[var(--bone-6)] backdrop-blur-xl text-bone-70 hover:text-bone-100 hover:bg-[var(--bone-15)] flex items-center justify-center pointer-events-auto hover:scale-110 active:scale-95 group/nav"
              >
                <ChevronUp strokeWidth={2} className="w-3.5 h-3.5 group-hover/nav:-translate-y-0.5" />
              </button>
            </Tooltip>
            <Tooltip content="Scroll to bottom">
              <button
                onClick={() => scrollToBottom('smooth')}
                className="w-7 h-7 rounded-[8px] bg-[var(--bone-6)] backdrop-blur-xl text-bone-70 hover:text-bone-100 hover:bg-[var(--bone-15)] flex items-center justify-center pointer-events-auto hover:scale-110 active:scale-95 group/nav"
              >
                <ChevronUp strokeWidth={2} className="w-3.5 h-3.5 rotate-180 group-hover/nav:translate-y-0.5" />
              </button>
            </Tooltip>
          </div>
        </div>


        <div className={cn(
          "shrink-0 relative",
          chatPageMode ? "px-0 pb-0 pt-3 border-none" : "px-6 pb-6 pt-3 border-none"
        )}>
          <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} />

          {/* Peeking Temporary Chat Notice Bubble (Floating behind Message Bar) */}
          {isTempChat && showTempNotice && aiMessages.length > 0 && (
            <div
              className={cn(
                "dark absolute top-3 -translate-y-[39px] h-10 flex items-center justify-between px-4 border-t border-l border-r border-[var(--bone-3)] select-none rounded-t-[16px] animate-fade-in shadow-md z-0 bg-[#121212]",
                chatPageMode ? "left-5 right-5" : "left-[38px] right-[38px]"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <MessageCircleDashed className="w-4 h-4 text-[var(--bone-100)] opacity-60 shrink-0" strokeWidth={2} />
                <span className="text-xs font-semibold text-[var(--bone-100)] tracking-wide leading-none">
                  Temporary Chat
                </span>
                {chatPageMode && (
                  <span className="text-[10px] text-[var(--bone-60)] opacity-70 tracking-wide leading-none hidden sm:inline ml-4">
                    This chat will disappear if you don't save it.
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Clear Chat Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearAIChat();
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[var(--bone-10)] text-[var(--bone-100)] opacity-60 hover:opacity-100 transition-all duration-200 cursor-pointer"
                  title="Clear Chat"
                >
                  <Eraser className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
                {/* Save Chat Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    saveTempChat();
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[var(--bone-10)] text-[var(--bone-100)] opacity-60 hover:opacity-100 transition-all duration-200 relative group cursor-pointer"
                  title="Save Chat"
                >
                  <Bookmark className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
                {/* Close/Dismiss Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTempNotice(false);
                  }}
                  className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[var(--bone-10)] text-[var(--bone-100)] opacity-60 hover:opacity-100 transition-all duration-200 cursor-pointer"
                  title="Dismiss notice"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          )}

          {/* Unified Message Bar Container */}
          {/* Unified Message Bar Container */}
          <div
            className={cn(
              "border flex flex-col relative transition-colors duration-300 z-10",
              `backdrop-blur-xl ${resolvedTheme === 'light' ? 'border-[var(--bone-6)]' : 'border-[var(--bone-3)]'} hover:border-[var(--bone-12)] focus-within:border-[var(--bone-12)] rounded-[20px] p-4 shadow-md`
            )}
            style={{ backgroundColor: 'var(--color-panel)' }}
          >

            {attachments.length > 0 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-1 border-b border-[var(--bone-12)]">
                {attachments.map((att, i) => (
                  <div key={`pending-att-${i}`} className="relative group shrink-0">
                    <div className={cn(
                      "rounded-[10px] overflow-hidden border border-[var(--bone-12)] bg-white/5 flex items-center justify-center",
                      att.type === 'audio' ? "w-auto h-auto" : "w-11 h-11"
                    )}>
                      {att.type === 'image' ? (
                        <div className="relative w-full h-full">
                          <img src={att.url} className={cn("w-full h-full object-cover", att.uploading && "opacity-40 blur-[1px]")} />
                          {att.uploading && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-4 h-4 border-2 border-bone-100 border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </div>
                      ) : att.type === 'audio' ? (
                        <div className="relative flex items-center">
                          <ChatAudioPlayer
                            url={att.url}
                            name={att.name}
                            isPending
                            onRemove={() => setAttachments(p => p.filter((_, idx) => idx !== i))}
                          />
                          {att.uploading && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-[10px]">
                              <div className="w-4 h-4 border-2 border-bone-100 border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="relative w-full h-full flex items-center justify-center">
                          {att.type === 'pdf' ? (
                            <FileText strokeWidth={2} className={cn("w-4 h-4 text-bone-70", att.uploading && "opacity-30")} />
                          ) : (
                            <Paperclip strokeWidth={2} className={cn("w-4 h-4 text-bone-70", att.uploading && "opacity-30")} />
                          )}
                          {att.uploading && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-4 h-4 border-2 border-bone-100 border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {att.type !== 'audio' && !att.uploading && (
                      <button
                        onClick={() => setAttachments(p => p.filter((_, idx) => idx !== i))}
                        className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 z-10  hover:scale-110"
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
                className="flex items-center justify-between bg-white/5 rounded-[10px] px-3 py-1.5 mb-1 border-l-2 border-white/30 gap-3 animate-fade-in shrink-0 cursor-pointer hover:bg-white/10 "
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-[9px] font-bold uppercase tracking-[0.05em] text-bone-70">
                    Replying to {activeReplyMessage.role === 'user' ? 'You' : 'AI'}
                  </span>
                  <span className="text-[11px] text-[var(--bone-70)] truncate font-medium">
                    {activeReplyMessage.content?.replace(new RegExp('<think>[\\\\s\\\\S]*?</think>', 'g'), '') || 'Attachment'}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setReplyMessage(null);
                  }}
                  className="p-1 rounded-md hover:bg-white/10 text-[var(--bone-40)] hover:text-white  shrink-0"
                >
                  <X strokeWidth={2} className="w-3 h-3" />
                </button>
              </div>
            )}
            <ChatInputEditable
              ref={textareaRef}
              value={assistantInput}
              isNewPage={isNewChatEmpty}
              onChange={(val) => { setAssistantInput(val); setCursorText(val); }}
              onCursorTextChange={(textUpToCursor) => setCursorText(textUpToCursor)}
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
                if (showMentionMenu && filteredEntities.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActiveCommandIndex(i => Math.min(i + 1, filteredEntities.length - 1));
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActiveCommandIndex(i => Math.max(i - 1, 0));
                    return;
                  }
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    const ent = filteredEntities[activeCommandIndex];
                    const newValue = assistantInput.replace(/@([^@]*)$/, `@${ent.title} `);
                    setAssistantInput(newValue);
                    setCursorText(newValue);
                    setShowMentionMenu(false);
                    return;
                  }
                  if (e.key === 'Escape') {
                    setShowMentionMenu(false);
                    return;
                  }
                }
                if (e.key === 'Enter' && !e.shiftKey) { 
                  e.preventDefault(); 
                  handleSend(); 
                }
              }}
              placeholder={pendingAdvisorState ? "Answer the advisor's questions..." : "Ask Flowr AI"}
            />

            {/* Action Bar */}
            <div className={cn("flex items-center justify-between", chatPageMode ? (isNewChatEmpty ? "mt-4" : "mt-3") : "mt-1")}>
              {/* Left Actions */}
              <div className="flex items-center gap-0.5 relative">
                {chatPageMode && showPlusMenu && plusMenuPos && (
                  <ChatPlusMenu
                    onClose={() => setShowPlusMenu(false)}
                    onMediaClick={() => fileInputRef.current?.click()}
                    position={plusMenuPos}
                  />
                )}
                <Tooltip content="Upload or Add">
                  <button
                    ref={plusMenuBtnRef}
                    onClick={() => {
                      if (chatPageMode) {
                        if (plusMenuBtnRef.current) {
                          const r = plusMenuBtnRef.current.getBoundingClientRect();
                          setPlusMenuPos({ bottom: window.innerHeight - r.top + 8, left: r.left });
                        }
                        setShowPlusMenu(v => !v);
                      } else {
                        fileInputRef.current?.click();
                      }
                    }}
                    className={cn(
                      "p-1.5 rounded-[8px]",
                      showPlusMenu
                        ? "bg-dark text-foreground"
                        : "text-bone-70 hover:text-foreground hover:bg-dark"
                    )}
                  >
                    <Plus strokeWidth={2} className="w-4 h-4" />
                  </button>
                </Tooltip>

                <Tooltip content="AI Actions">
                  <button
                    onClick={() => {
                      if (!assistantInput.startsWith('/')) {
                        setAssistantInput('/');
                        textareaRef.current?.focus();
                      } else {
                        setShowCommandMenu(!showCommandMenu);
                      }
                    }}
                    className={cn(
                      "p-1.5 rounded-[8px] ",
                      showCommandMenu ? "bg-dark text-foreground" : "text-bone-70 hover:text-foreground hover:bg-dark"
                    )}
                  >
                    <SquareSlash strokeWidth={2} className="w-4 h-4" />
                  </button>
                </Tooltip>
              </div>

              {/* Right Actions */}
              <div className="flex items-center gap-0.5">
                {/* Mode selector */}
                <div className="relative">
                  <Tooltip content="Switch Model">
                    <button
                      ref={modeMenuBtnRef}
                      onClick={() => {
                        if (modeMenuBtnRef.current) {
                          const r = modeMenuBtnRef.current.getBoundingClientRect()
                          setModeMenuPos({ bottom: window.innerHeight - r.top + 8, right: window.innerWidth - r.right })
                        }
                        setShowModeMenu(v => !v)
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded-[8px]",
                        showModeMenu
                          ? "bg-dark text-foreground"
                          : "text-bone-70 hover:text-foreground hover:bg-dark"
                      )}
                    >
                      <span className="hidden sm:inline text-[15px] font-normal tracking-widest pt-0.5">{MODE_OPTIONS.find(m => m.key === activeMode)?.label}</span>
                      <ChevronUp strokeWidth={2} className={cn("w-3 h-3 transition-transform duration-300", showModeMenu ? "rotate-180 opacity-100" : "opacity-40")} />
                    </button>
                  </Tooltip>

                  {showModeMenu && modeMenuPos && createPortal(
                    <>
                      <div
                        className="fixed inset-0 z-[140]"
                        onClick={() => setShowModeMenu(false)}
                      />
                      <div
                        className="fixed z-[150] bg-[var(--color-panel)] border border-[var(--bone-12)] rounded-[var(--radius-regular)] overflow-hidden min-w-[180px] backdrop-blur-3xl shadow-2xl p-1 flex flex-col gap-[2px]"
                        style={{ bottom: modeMenuPos.bottom, right: modeMenuPos.right }}
                      >
                        <div className="flex flex-col gap-[2px]">
                          {MODE_OPTIONS.map(opt => (
                            <button
                              key={opt.key}
                              onClick={() => { setActiveMode(opt.key); setShowModeMenu(false) }}
                              className={cn(
                                'w-full flex items-center px-3 py-[4px] rounded-[var(--radius-medium)] text-[13.5px] text-left group transition-none text-[var(--bone-70)] hover:bg-[var(--bone-6)] hover:text-bone-100',
                                activeMode === opt.key && 'bg-dark text-bone-100'
                              )}
                            >
                              <div className="flex flex-col">
                                <p className="tracking-wide">{opt.label}</p>
                                <p className="text-[12px] tracking-[0.06em] opacity-30 leading-none mt-0.5">{opt.description}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                        <div className="popup-divider" />
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => setThinkingEnabled(!thinkingEnabled)}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-[4px] rounded-[var(--radius-medium)] text-[13.5px] transition-none text-[var(--bone-70)] hover:bg-[var(--bone-6)] hover:text-bone-100',
                              thinkingEnabled && 'text-bone-100'
                            )}
                          >
                            <div className="flex flex-col items-start">
                              <Tooltip content="Enables step-by-step reasoning">
                                <span className="tracking-wide">Thinking</span>
                              </Tooltip>
                            </div>
                            <Toggle
                              size="sm"
                              checked={thinkingEnabled}
                              onChange={setThinkingEnabled}
                              className="ml-auto pointer-events-none"
                            />
                          </button>
                          <button
                            onClick={() => setAdvisorEnabled(!advisorEnabled)}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-[4px] rounded-[var(--radius-medium)] text-[13.5px] transition-none text-[var(--bone-70)] hover:bg-[var(--bone-6)] hover:text-bone-100',
                              advisorEnabled && 'text-bone-100'
                            )}
                          >
                            <div className="flex flex-col items-start">
                              <Tooltip content="Asks clarifying questions to refine your request">
                                <span className="tracking-wide">Advisor</span>
                              </Tooltip>
                            </div>
                            <Toggle
                              size="sm"
                              checked={advisorEnabled}
                              onChange={setAdvisorEnabled}
                              className="ml-auto pointer-events-none"
                            />
                          </button>
                          {aiSessionContext?.distilled_summary && (
                            <>
                              <div className="popup-divider" />
                              <button
                                onClick={() => {
                                  openModal({ kind: 'summaryPreview', summary: aiSessionContext.distilled_summary! });
                                  setShowModeMenu(false);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-[4px] rounded-[var(--radius-medium)] text-[13.5px] transition-none text-[var(--bone-70)] hover:bg-[var(--bone-6)] hover:text-bone-100"
                              >
                                <Brain className="w-4 h-4 shrink-0 opacity-60 text-accent animate-pulse" strokeWidth={2} />
                                <div className="flex flex-col items-start">
                                  <span className="tracking-wide text-accent font-semibold">View Memory Summary</span>
                                  <span className="text-[12px] tracking-[0.06em] opacity-30 leading-none mt-0.5">Preview condensed history</span>
                                </div>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </>,
                    document.body
                  )}
                </div>





                <div
                  ref={contextMeterRef}
                  className="relative flex items-center gap-2 px-1"
                  onMouseEnter={() => {
                    if (contextMeterRef.current) {
                      const r = contextMeterRef.current.getBoundingClientRect();
                      setContextTooltipPos({ bottom: window.innerHeight - r.top + 8, right: window.innerWidth - r.right });
                    }
                    openContextTooltip();
                  }}
                  onMouseLeave={closeContextTooltip}
                >
                  <div className="flex items-center gap-2 z-10 cursor-help">
                    {aiSessionContext && (
                      <div className="relative w-4 h-4 flex items-center justify-center">
                        <ContextMeter
                          usage={displayedTokens}
                          limit={aiSessionContext.context_limit}
                          threshold={aiSessionContext.compaction_threshold}
                          size={16}
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[7px] font-bold text-bone-100">
                            {Math.round((displayedTokens / aiSessionContext.context_limit) * 100)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {aiSessionContext && showContextTooltip && contextTooltipPos && createPortal(
                    <div
                      className="fixed bg-[var(--color-panel)] p-4 rounded-[16px] border border-[var(--bone-12)] backdrop-blur-3xl w-[220px]"
                      style={{ bottom: contextTooltipPos.bottom, right: contextTooltipPos.right, zIndex: 150 }}
                      onMouseEnter={openContextTooltip}
                      onMouseLeave={closeContextTooltip}
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center text-[11px] font-bold text-bone-80">
                          <span className="tracking-tight">Memory Usage</span>
                          <span className="text-bone-100">{Math.round((displayedTokens / aiSessionContext.context_limit) * 100)}%</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full duration-1000",
                              (displayedTokens / aiSessionContext.context_limit) > aiSessionContext.compaction_threshold ? "bg-white/40" : "bg-[var(--brand-blue)]"
                            )}
                            style={{ width: `${Math.min((displayedTokens / aiSessionContext.context_limit) * 100, 100)}%` }}
                          />
                        </div>
                        <div className="flex flex-col gap-2 mb-2 shrink-0">
                          {aiMessages.filter(m => m.role === 'user' || m.role === 'assistant').length === 0 && (
                            <div className="text-[11px] text-bone-50 leading-tight">
                              Press <span className="font-mono text-[9px] bg-white/10 px-1 py-0.5 rounded text-bone-80">/</span> for tools
                            </div>
                          )}
                          <p className="text-[10px] text-bone-70 font-medium">
                            {displayedTokens.toLocaleString()} / {aiSessionContext.context_limit.toLocaleString()} tokens
                          </p>
                          <p className="text-[9px] text-bone-30 opacity-60 leading-relaxed italic">
                            {(displayedTokens / aiSessionContext.context_limit) > aiSessionContext.compaction_threshold
                              ? "Memory full. Preparing to distill..."
                              : "Session history is currently clear and fast."}
                          </p>
                        </div>

                        {(() => {
                          const msgCount = aiMessages.filter(m => m.role === 'user' || m.role === 'assistant').length
                          const belowMinMsgs = msgCount < 5
                          const minTokens = (aiSessionContext?.context_limit ?? 32000) * 0.5
                          const belowMinTokens = displayedTokens < minTokens
                          const canCompact = !isCompacting && !belowMinMsgs && !belowMinTokens
                          return (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                await compactAIChat();
                              }}
                              disabled={!canCompact}
                              className={cn(
                                "w-full py-1.5 rounded-[8px] text-[10px] font-semibold tracking-tight pointer-events-auto flex items-center justify-center gap-2",
                                canCompact
                                  ? "bg-white/10 text-bone-100 hover:bg-white/20 active:scale-[0.98]"
                                  : "bg-white/5 text-bone-20 cursor-not-allowed opacity-50"
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
                          )
                        })()}
                        {aiSessionContext?.distilled_summary && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openModal({ kind: 'summaryPreview', summary: aiSessionContext.distilled_summary! });
                              setShowContextTooltip(false);
                            }}
                            className="w-full mt-1.5 py-1.5 rounded-[8px] text-[10px] font-bold tracking-tight pointer-events-auto flex items-center justify-center gap-2 bg-accent/20 border border-accent/40 text-bone-100 hover:bg-accent/35 hover:text-white transition-all active:scale-[0.98]"
                          >
                            <FileText className="w-3.5 h-3.5 text-accent" />
                            <span>View Distilled Summary</span>
                          </button>
                        )}
                      </div>
                    </div>,
                    document.body
                  )}
                </div>

                {isAILoading ? (
                  <Tooltip content="Stop generation">
                    <button
                      onClick={stopAIGeneration}
                      className="w-7 h-7 shrink-0 flex items-center justify-center rounded-[8px] bg-red-400/10 text-red-500 hover:bg-red-400/20  active:scale-90"
                    >
                      <Square strokeWidth={2} className="w-2.5 h-2.5 fill-current" />
                    </button>
                  </Tooltip>
                ) : (!assistantInput.trim() && attachments.length === 0) ? (
                  <Tooltip content="Voice Input (Right-click for settings)">
                    <button
                      onMouseDown={(e) => { if (e.button === 0) startRecording(); }}
                      onMouseUp={() => stopRecording()}
                      onMouseLeave={() => { if (isRecording) stopRecording(); }}
                      onContextMenu={handleMicContextMenu}
                      className={cn(
                        "w-7 h-7 rounded-[8px] flex items-center justify-center relative shrink-0  group/mic",
                        isRecording
                          ? "bg-red-500 text-white scale-110"
                          : cn("text-bone-70 hover:text-foreground hover:bg-dark", showMicSettings && "!bg-[var(--bone-15)] !text-[var(--bone-100)] !opacity-100")
                      )}
                    >
                      <Mic strokeWidth={2} className={cn("w-[18px] h-[18px]", isRecording && "animate-pulse")} />
                      {isRecording && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-ping" />
                      )}
                    </button>
                  </Tooltip>
                ) : (
                  <Tooltip content="Send Message">
                    <button
                      onClick={() => handleSend()}
                      disabled={attachments.some(att => att.uploading)}
                      className={cn(
                        "w-7 h-7 shrink-0 flex items-center justify-center rounded-[8px] bg-white/10 text-bone-100 hover:bg-white/20 active:scale-90",
                        attachments.some(att => att.uploading) && "opacity-40 cursor-not-allowed pointer-events-none"
                      )}
                    >
                      <ArrowUp strokeWidth={2} className="w-[18px] h-[18px]" />
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>

            {/* Command Menu Portal (Local to container) */}
            {showCommandMenu && filteredCommands.length > 0 && (
              <div className={cn(
                "absolute left-0 right-0 bg-[var(--color-panel)] backdrop-blur-3xl rounded-[var(--radius-regular)] border border-[var(--bone-12)] overflow-hidden shadow-2xl z-[140] p-1 flex flex-col gap-[2px]",
                isNewChatEmpty ? "top-full mt-4" : "bottom-full mb-4"
              )}>
                <div className="px-3 pt-1 pb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--bone-30)] opacity-80">
                    Actions & Commands
                  </span>
                </div>
                <div className="max-h-80 overflow-y-auto scrollbar-none flex flex-col gap-[2px]">
                  {filteredCommands.map((cmd, i) => (
                    <button
                      key={cmd.id}
                      onClick={() => handleCommandSelect(cmd)}
                      onMouseEnter={() => setActiveCommandIndex(i)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-[4px] rounded-[var(--radius-medium)] text-left group transition-none",
                        i === activeCommandIndex
                          ? "bg-[var(--bone-6)] text-[var(--bone-100)]"
                          : "text-[var(--bone-70)] hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)]"
                      )}
                    >
                      <div className={cn(
                        // Opaque currentColor + element opacity for dimming: a translucent icon color
                        // makes overlapping Lucide segments (e.g. the Layers icon) composite twice into a
                        // visible "stacked stroke" seam. Keep the color solid and let opacity-* fade it.
                        "w-4 h-4 flex items-center justify-center shrink-0 text-bone-100 opacity-60 group-hover:opacity-100",
                        i === activeCommandIndex && "opacity-100"
                      )}>
                        {cmd.icon}
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <p className="text-[13.5px] tracking-wide shrink-0">{cmd.label}</p>
                        {cmd.description && (
                          <p className="text-[11px] tracking-wide text-bone-70 opacity-40 truncate">{cmd.description}</p>
                        )}
                      </div>
                      {(cmd.prefix || i === activeCommandIndex) && (
                        <div className="flex items-center gap-0.5 shrink-0 ml-2">
                          <span className="px-1.5 py-0.5 rounded-[4px] bg-white/5 text-[10px] font-mono tracking-wide text-bone-70">
                            {cmd.prefix ? cmd.prefix.trim() : 'ENTER'}
                          </span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mention Menu Portal (Local to container) */}
            {showMentionMenu && filteredEntities.length > 0 && (
              <div className={cn(
                "absolute left-0 right-0 bg-[var(--color-panel)] backdrop-blur-3xl rounded-[var(--radius-regular)] border border-[var(--bone-12)] overflow-hidden shadow-2xl z-[140] p-1 flex flex-col gap-[2px]",
                isNewChatEmpty ? "top-full mt-4" : "bottom-full mb-4"
              )}>
                <div className="max-h-[192px] overflow-y-auto scrollbar-none flex flex-col gap-[2px]">
                  {filteredEntities.map((ent, i) => (
                    <button
                      key={ent.id}
                      onClick={() => {
                        const newValue = assistantInput.replace(/@([^@]*)$/, `@${ent.title} `);
                        setAssistantInput(newValue);
                        setCursorText(newValue);
                        setShowMentionMenu(false);
                      }}
                      onMouseEnter={() => setActiveCommandIndex(i)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-[4px] rounded-[var(--radius-medium)] text-left group transition-none",
                        i === activeCommandIndex
                          ? "bg-[var(--bone-6)] text-[var(--bone-100)]"
                          : "text-[var(--bone-70)] hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)]"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 flex items-center justify-center shrink-0 text-bone-100 opacity-60 group-hover:opacity-100",
                        i === activeCommandIndex && "opacity-100"
                      )}>
                        {ent.icon}
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <p className="text-[13.5px] tracking-wide shrink-0">{ent.title}</p>
                        <p className="text-[11px] tracking-wide text-bone-70 opacity-40 truncate">{ent.type.charAt(0).toUpperCase() + ent.type.slice(1)}</p>
                      </div>
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
