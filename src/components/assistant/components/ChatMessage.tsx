"use client";

import React, { memo, useState, useRef, useEffect, useMemo, createContext, useContext } from 'react';
import { Copy, ThumbsUp, ThumbsDown, RotateCcw, Paperclip, CornerUpLeft, FileText, ClipboardCopy, ChevronDown, Sparkles, CheckCircle2, Brain, Check } from 'lucide-react';
import { useStore } from '@/data/store';
import type { AIMessage, AIAttachment, EditorBlock } from '@/data/store';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Tooltip } from '../../layout/Tooltip';
import { AIAvatar } from './AIAvatar';
import { StatusTyping } from './StatusTyping';
import { ChatImage } from './ChatImage';
import { ChatAudioPlayer } from './ChatAudioPlayer';
import clsx from 'clsx';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { parseMarkdownToBlocks } from '@/lib/utils/markdownToBlocks';

const InTableContext = createContext(false);

// Pre-compiled regexes
const THINK_TAG_FULL = /<think>[\s\S]*?<\/think>/g;
const THINK_TAG_PARTIAL = /<think>[\s\S]*$/;
const ALL_TOOLS_FULL_REGEX = /(?:!function_call:)?(add_note|add_folder|add_canvas|update_note_content|append_note_content|generate_image|web_search|delete_entity|rename_entity|add_task|delete_task|complete_task|update_task|move_entity|navigate_to|read_note|sort_entities)\s*\{[\s\S]*?\}/g;
const ALL_TOOLS_REGEX = /(add_note|add_folder|add_canvas|update_note_content|append_note_content|generate_image|web_search|delete_entity|rename_entity|add_task|delete_task|complete_task|update_task|move_entity|navigate_to|read_note|sort_entities)\s*\{[\s\S]*$/;

const ARROW_MAP: Record<string, string> = {
  '-->': '⟶',
  '->': '→',
  '==>': '⇒',
  '<--': '⟵',
  '<-': '←',
  '<==': '⇐',
  '<->': '↔',
  '/arrowdown': '↓',
  '/arrowup': '↑',
  '/arrowright': '→',
  '/arrowleft': '←'
};

const STYLE_REGEX = /(-->|->|==>|<--|<-|<==|<->|\/arrowdown|\/arrowup|\/arrowright|\/arrowleft|\[m\]|\[\/m\]|\[30\]|\[\/30\]|\[60\]|\[\/60\]|\[100\]|\[\/100\]|\[a\]|\[\/a\]|\[a30\]|\[\/a30\]|\[a60\]|\[\/a60\])/g;

const renderContentWithStyles = (content: any): any => {
  if (typeof content === 'string') {
    const parts = content.split(STYLE_REGEX);
    if (parts.length <= 1) return content;
    
    const result = [];
    const stack: string[] = [];
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      
      if (ARROW_MAP[part]) {
        const activeColor = stack.find(s => s.startsWith('text-')) || 'text-[var(--bone-60)]';
        const isMono = stack.includes('font-mono');
        result.push(
          <span 
            key={i} 
            className={clsx(
              "inline-flex items-center justify-center mx-0.5 font-bold scale-110 transform transition-all align-baseline", 
              isMono ? "font-mono" : "font-sans", 
              activeColor
            )} 
            title={part}
          >
            {ARROW_MAP[part]}
          </span>
        );
      } else if (part === '[m]') {
        stack.push('font-mono');
      } else if (part === '[/m]') {
        const idx = stack.lastIndexOf('font-mono');
        if (idx !== -1) stack.splice(idx, 1);
      } else if (part === '[30]') {
        stack.push('text-[var(--bone-30)]');
      } else if (part === '[/30]') {
        const idx = stack.lastIndexOf('text-[var(--bone-30)]');
        if (idx !== -1) stack.splice(idx, 1);
      } else if (part === '[60]') {
        stack.push('text-[var(--bone-60)]');
      } else if (part === '[/60]') {
        const idx = stack.lastIndexOf('text-[var(--bone-60)]');
        if (idx !== -1) stack.splice(idx, 1);
      } else if (part === '[100]') {
        stack.push('text-[var(--bone-100)]');
      } else if (part === '[/100]') {
        const idx = stack.lastIndexOf('text-[var(--bone-100)]');
        if (idx !== -1) stack.splice(idx, 1);
      } else if (part === '[a]') {
        stack.push('text-[var(--bone-100)]');
      } else if (part === '[/a]') {
        const idx = stack.lastIndexOf('text-[var(--bone-100)]');
        if (idx !== -1) stack.splice(idx, 1);
      } else if (part === '[a30]') {
        stack.push('text-[var(--bone-30)]');
      } else if (part === '[/a30]') {
        const idx = stack.lastIndexOf('text-[var(--bone-30)]');
        if (idx !== -1) stack.splice(idx, 1);
      } else if (part === '[a60]') {
        stack.push('text-[var(--bone-60)]');
      } else if (part === '[/a60]') {
        const idx = stack.lastIndexOf('text-[var(--bone-60)]');
        if (idx !== -1) stack.splice(idx, 1);
      } else {
        if (stack.length > 0) {
          const isMono = stack.includes('font-mono');
          result.push(
            <span 
              key={i} 
              className={clsx(stack)} 
              style={isMono ? { fontFamily: 'DM Mono' } : undefined}
            >
              {part}
            </span>
          );
        } else {
          result.push(part);
        }
      }
    }
    return result;
  }
  if (Array.isArray(content)) {
    return content.map((c, i) => (
      <React.Fragment key={i}>
        {renderContentWithStyles(c)}
      </React.Fragment>
    ));
  }
  return content;
};

const looksLikeImageContent = (text: string) => {
  if (!text) return false;
  // Standard permissive regex for image markdown
  return /!\[.*?\]\s*\(\s*(data:image\/|https?:\/\/|AUO)/.test(text);
};

export const sanitizeContent = (content: string, isAILoading: boolean, isLastMessage: boolean) => {
  if (!content) return "";
  
  // If it's already a clean image markdown from the backend, skip complex sanitization
  // that might mangle large data URIs
  if (looksLikeImageContent(content) && content.length > 5000) {
    return content.trim();
  }

  let text = content;

  // 1. Protect Markdown images from sanitization (especially large data URIs)
  const images: string[] = [];
  // Match markdown images: ![alt](src)
  // We use a non-greedy [\s\S]*? for the src to handle multi-line or massive base64 strings
  // We also try to match things that look like data URIs even if they don't have the prefix yet (though the backend should add it)
  text = text.replace(/!\[.*?\]\s*\(\s*(data:image\/[\s\S]*?|https?:\/\/[\s\S]*?|AUO[\s\S]*?)\s*\)/g, (match) => {
    images.push(match.trim());
    return `__IMG_PLACEHOLDER_${images.length - 1}__`;
  });

  // 2. Perform standard sanitization
  text = text.replace(THINK_TAG_FULL, '');
  text = text.replace(/<system-notes>[\s\S]*?<\/system-notes>/g, '');
  if (isAILoading && isLastMessage) {
    text = text.replace(THINK_TAG_PARTIAL, '');
    text = text.replace(/<system-notes>[\s\S]*$/, '');
  }

  text = text.replace(ALL_TOOLS_FULL_REGEX, "");

  // Filter out internal reasoning patterns
  const reasoningPatterns = [
    /\*Neutrality:\*.*?\n/gi,
    /\*Accuracy:\*.*?\n/gi,
    /\*Factual accuracy:\*.*?\n/gi,
    /\*Completeness:\*.*?\n/gi,
    /\*Directness:\*.*?\n/gi,
    /\*Option [A-Z0-9] \(.*?\):\*.*?\n/gi,
    /\*Final version plan:\*.*?\n/gi,
    /\*Self-Correction.*?:\*.*?\n/gi,
    /\*Refined Final Version:\*.*?\n/gi,
    /\*Perspective \d+:.*?\n/gi,
    /\*Direct Answer:\*.*?\n/gi,
  ];
  reasoningPatterns.forEach(pattern => {
    text = text.replace(pattern, '');
  });

  if (isAILoading && isLastMessage) {
    if (ALL_TOOLS_REGEX.test(text)) {
      text = text.replace(ALL_TOOLS_REGEX, 'Preparing tool...');
    }
  }

  const lowerText = text.toLowerCase();
  const reminderIdx = lowerText.indexOf('(reminder:');
  if (reminderIdx !== -1) {
    const prefix = text.substring(0, reminderIdx);
    const rest = text.substring(reminderIdx);
    const closingIdx = rest.indexOf(')');
    if (closingIdx !== -1) {
      text = prefix + rest.substring(closingIdx + 1);
    } else {
      text = prefix;
    }
  }

  text = text.replace(/```json[\s\S]*?\{[\s\n\r]*"action"[\s\S]*?\}[\s\S]*?```/g, '');
  text = text.replace(/\{[\s\n\r]*"action"[\s\S]*?\}/g, '');
  text = text.replace(/(?<![!\[])(add_note|add_folder|add_canvas|add_task|update_note_content|append_note_content|generate_image)\s*\([\s\S]*?\);?/g, '');

  text = text.trim();

  if (text.startsWith('!function_call:') && text.endsWith('}')) return "";
  if (text === '}' || text === '{' || text === '!function_call:') return "";

  // 3. Restore protected images
  images.forEach((img, i) => {
    text = text.replace(`__IMG_PLACEHOLDER_${i}__`, () => img);
  });

  return text;
};

const ApplyNoteCard = ({ content }: { content: string }) => {
  const activeEntityId = useStore(state => state.activeEntityId);
  const updateEntityContent = useStore(state => state.updateEntityContent);
  const [applied, setApplied] = useState(false);

  const handleApply = () => {
    if (!activeEntityId) return;
    const blocks = parseMarkdownToBlocks(content);
    updateEntityContent(activeEntityId, blocks);
    setApplied(true);
    setTimeout(() => setApplied(false), 3000);
  };

  return (
    <div className="my-4 w-full p-4 rounded-[17px] bg-emerald-500/5 border border-emerald-500/20 relative overflow-hidden backdrop-blur-xl group">
      <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-emerald-500/10 rounded-full blur-[60px] pointer-events-none transition-opacity group-hover:opacity-100" />
      <div className="flex flex-col gap-3 relative z-10 w-full">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400/80">Proposed Note Improvement</p>
          </div>
          <button
            onClick={handleApply}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-bold uppercase transition-all duration-300",
              applied 
                ? "bg-emerald-500 text-white scale-[1.02]" 
                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white active:scale-[0.98]"
            )}
          >
            {applied ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Applied Successfully</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                <span>Apply Changes</span>
              </>
            )}
          </button>
        </div>
        <div className="w-full max-h-[140px] overflow-y-auto bg-black/20 p-3 rounded-[12px] text-[12.5px] font-medium leading-[133%] text-bone-60 font-sans border border-white/5 custom-scrollbar">
          <pre className="whitespace-pre-wrap font-sans text-bone-80 leading-[133%] font-medium w-full">{content}</pre>
        </div>
      </div>
    </div>
  );
};

const ApplyCanvasCard = ({ content }: { content: string }) => {
  const blocks = useStore(state => state.blocks);
  const addCanvasBlock = useStore(state => state.addCanvasBlock);
  const updateCanvasBlock = useStore(state => state.updateCanvasBlock);
  const activeEntityId = useStore(state => state.activeEntityId);
  const entities = useStore(state => state.entities);
  const addEntity = useStore(state => state.addEntity);
  const setActiveEntityId = useStore(state => state.setActiveEntityId);
  const [applied, setApplied] = useState(false);

  const handleApply = () => {
    try {
      const items = JSON.parse(content);
      if (Array.isArray(items)) {
        // Route Redirect Logic: Ensure an active canvas exists before injecting blocks!
        let targetCanvasId = activeEntityId;
        const activeEntity = entities.find(e => e.id === activeEntityId);
        
        if (!activeEntity || activeEntity.type !== 'canvas') {
          // Create new auto-generated canvas first!
          const newCanvasId = addEntity({ type: 'canvas', title: 'Applied Flow Workspace' });
          if (newCanvasId) {
             setActiveEntityId(newCanvasId);
             targetCanvasId = newCanvasId;
          }
        }

        items.forEach((item: any) => {
          if (item.id) {
            const exists = blocks.some(b => b.id === item.id);
            if (exists) {
              updateCanvasBlock(item.id, item);
            } else {
              addCanvasBlock({
                id: item.id,
                type: item.type || 'shape',
                shapeKind: item.shapeKind || (item.type === 'connection' ? undefined : 'rect'),
                content: item.content || '',
                x: typeof item.x === 'number' ? item.x : 100,
                y: typeof item.y === 'number' ? item.y : 100,
                width: typeof item.width === 'number' ? item.width : (item.type === 'connection' ? 0 : 180),
                height: typeof item.height === 'number' ? item.height : (item.type === 'connection' ? 0 : 60),
                canvasId: targetCanvasId || undefined,
                canvasStyleExt: item.canvasStyleExt || {
                  stroke: '#d38f36',
                  strokeWidth: 1.5,
                  strokeStyle: 'solid',
                  fill: '#d38f36',
                  fillOpacity: 0.1,
                },
                ...item
              });
            }
          }
        });
        setApplied(true);
        setTimeout(() => setApplied(false), 3000);
      }
    } catch (e) {
      console.error("Failed to parse apply-canvas JSON", e);
    }
  };

  return (
    <div className="my-4 w-full p-4 rounded-[17px] bg-white/5 border border-white/10 relative overflow-hidden backdrop-blur-xl group">
      <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-white/5 rounded-full blur-[60px] pointer-events-none transition-opacity group-hover:opacity-100" />
      <div className="flex flex-col gap-3 relative z-10 w-full">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-white/5 animate-pulse" />
              <div className="relative flex items-center justify-center w-full h-full">
                <div className="relative h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/40 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-bone-100"></span>
                </div>
              </div>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-bone-60">Proposed Canvas Update</p>
          </div>
          <button
            onClick={handleApply}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-bold uppercase transition-all duration-300",
              applied 
                ? "bg-bone-100 text-black scale-[1.02]" 
                : "bg-white/10 text-bone-100 border border-white/20 hover:bg-white/20 active:scale-[0.98]"
            )}
          >
            {applied ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Applied Successfully</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                <span>Apply Changes</span>
              </>
            )}
          </button>
        </div>
        <div className="w-full max-h-[140px] overflow-y-auto bg-black/20 p-3 rounded-[12px] text-[12.5px] font-mono leading-[133%] text-bone-60 border border-white/5 custom-scrollbar">
          <pre className="whitespace-pre-wrap leading-[133%] font-medium w-full">{content}</pre>
        </div>
      </div>
    </div>
  );
};

export const ChatMessage = memo(({
  msg,
  isAILoading,
  isLast,
  scrollToBottom,
  handleAddImageToWorkspace,
  onRegenerate,
  onReply
}: {
  msg: AIMessage;
  isAILoading: boolean;
  isLast: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  handleAddImageToWorkspace: (url: string) => void;
  onRegenerate?: () => void;
  onReply: (msg: AIMessage) => void;
}) => {
  const openModal = useStore(state => state.openModal);
  const activeEntityId = useStore(state => state.activeEntityId);
  const entities = useStore(state => state.entities);
  const addEntity = useStore(state => state.addEntity);
  const updateEntityContent = useStore(state => state.updateEntityContent);
  const aiSessionContext = useStore(state => state.aiSessionContext);

  const activeNote = useMemo(() => activeEntityId ? entities.find(e => e.id === activeEntityId) : null, [activeEntityId, entities]);
  const isNoteActive = activeNote?.type === 'note' || activeNote?.type === 'mixed';

  const handleCopyToNote = (asNew: boolean = false) => {
    const cleanContent = sanitizeContent(msg.content || '', false, false);
    const blocks = parseMarkdownToBlocks(cleanContent);
    if (isNoteActive && !asNew && activeNote) {
      const existingContent = activeNote.content || [];
      const newBlocks = [...existingContent, ...blocks];
      updateEntityContent(activeNote.id, newBlocks);
    } else {
      const titleBlock = blocks.find(b => b.style === 'title' || b.style === 'heading' || b.style === 'subheading');
      const titleText = titleBlock ? (titleBlock.content || 'AI Note') : 'AI Note - ' + new Date().toLocaleDateString();
      addEntity({ type: 'note', title: titleText, content: blocks });
    }
  };

  const targetContent = useMemo(() => {
    const raw = msg.content || '';
    if (looksLikeImageContent(raw) && raw.length > 5000) {
      return raw.trim();
    }
    
    let content = sanitizeContent(raw, isAILoading, isLast)
    if (msg.citations && msg.citations.length > 0) {
      msg.citations.forEach((url, i) => {
        const num = i + 1;
        const regex = new RegExp(`\\[${num}\\](?![\\(\\[])`, 'g');
        content = content.replace(regex, `[${num}](${url})`);
      });
    }
    return content;
  }, [msg.content, isAILoading, isLast, msg.citations]);

  const thinkingEnabled = useStore(state => state.thinkingEnabled);
  const thinkContent = useMemo(() => {
    if (!msg.content) return '';
    const matchFull = msg.content.match(THINK_TAG_FULL);
    if (matchFull) return matchFull[0].replace(/<\/?think>/g, '').trim();
    if (isAILoading && isLast) {
      const matchPartial = msg.content.match(THINK_TAG_PARTIAL);
      if (matchPartial) return matchPartial[0].replace(/<think>/, '').trim();
    }
    return '';
  }, [msg.content, isAILoading, isLast]);

  const hasThinking = thinkingEnabled && !!thinkContent;
  const [showThinking, setShowThinking] = useState(false);

  const isImageContent = looksLikeImageContent(targetContent);
  const isPureImage = useMemo(() => {
    if (!targetContent) return false;
    const trimmed = targetContent.trim();
    return /^!\[.*?\]\s*\(\s*(data:image\/|https?:\/\/|AUO)[\s\S]*?(\s*\)|$)/.test(trimmed);
  }, [targetContent]);
  const isInitiallyFinished = isImageContent || !isLast || !isAILoading || targetContent.length > 5000;
  const [displayContent, setDisplayContent] = useState(isLast && isAILoading ? '' : targetContent);
  const [hasFinishedTyping, setHasFinishedTyping] = useState(!(isLast && isAILoading));
  
  useEffect(() => {
    if (isLast && isAILoading) {
      if (displayContent !== '') setDisplayContent('');
      if (hasFinishedTyping) setHasFinishedTyping(false);
      return;
    }

    const isFresh = Date.now() - new Date(msg.timestamp || Date.now()).getTime() < 2000;
    if (!isInitiallyFinished && isFresh && hasFinishedTyping) {
      setDisplayContent('');
      setHasFinishedTyping(false);
    }
  }, [isAILoading, isLast, msg.timestamp, isInitiallyFinished, targetContent]);
  const [feedbackState, setFeedbackState] = useState<'like' | 'dislike' | null>(null);
  const soundPlayedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const displayedLenRef = useRef(isInitiallyFinished ? targetContent.length : 0);
  const lastTimeRef = useRef(0);

  const [elapsed, setElapsed] = useState(0)
  const [completionTime, setCompletionTime] = useState<number | null>(null)
  const timerStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (msg.role === 'assistant') {
      if (isAILoading && isLast) {
        if (!timerStartRef.current) {
          timerStartRef.current = Date.now();
        }
        const timer = setInterval(() => {
          if (timerStartRef.current) {
            setElapsed(Date.now() - timerStartRef.current);
          }
        }, 10);
        return () => clearInterval(timer);
      } else if (!isAILoading && elapsed > 0 && !completionTime) {
        setCompletionTime(elapsed);
        timerStartRef.current = null;
        if (msg.logId) {
          fetch('/api/ai/log-duration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logId: msg.logId, durationMs: elapsed })
          }).catch(() => { });
        }
      }
    }
  }, [msg.role, isLast, isAILoading, completionTime, msg.logId, elapsed]);

  useEffect(() => {
    if (msg.role === 'user' || hasFinishedTyping || isInitiallyFinished) {
      setDisplayContent(targetContent);
      displayedLenRef.current = targetContent.length;
      if (!hasFinishedTyping) setHasFinishedTyping(true);
      return;
    }

    if (targetContent.length - displayedLenRef.current > 2000) {
      setDisplayContent(targetContent);
      displayedLenRef.current = targetContent.length;
      return;
    }

    const MIN_MS = 45;
    const BASE_MS = 80;
    const MAX_LAG = 300;

    const step = (now: number) => {
      const target = targetContent;
      const current = displayedLenRef.current;
      const remaining = target.length - current;

      if (remaining <= 0) {
        if (!isAILoading) {
          setHasFinishedTyping(true);
          if (!soundPlayedRef.current && msg.role === 'assistant') {
            const audio = new Audio('/notification-sound.mp3');
            audio.volume = 0.35;
            audio.play().catch(() => { });
            soundPlayedRef.current = true;
          }
        }
        lastTimeRef.current = 0;
        return;
      }

      let wordsToAdd = 1;
      let currentInterval = BASE_MS + (Math.random() * 20 - 10);

      if (remaining > MAX_LAG) {
        wordsToAdd = 2;
        currentInterval = MIN_MS;
      } else if (remaining > 60) {
        wordsToAdd = 1;
        currentInterval = BASE_MS * 0.8;
      }

      const elapsedT = lastTimeRef.current ? (now - lastTimeRef.current) : 1000;
      if (elapsedT < currentInterval) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      lastTimeRef.current = now;

      let next = current;
      for (let i = 0; i < wordsToAdd; i++) {
        const remainingText = target.substring(next + 1);
        const nextSpace = remainingText.search(/\s/);
        if (nextSpace === -1) {
          next = target.length;
          break;
        }
        next = next + 1 + nextSpace;
      }

      displayedLenRef.current = next;
      setDisplayContent(target.substring(0, next));
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [targetContent, msg.role, isAILoading, hasFinishedTyping, isInitiallyFinished]);

  useEffect(() => {
    let unchangedTimeout: NodeJS.Timeout | null = null;
    if (targetContent.length === 0) return;
    if (targetContent.length === displayedLenRef.current && isAILoading) {
      unchangedTimeout = setTimeout(() => {
        setHasFinishedTyping(true);
      }, 1500);
    }
    return () => { if (unchangedTimeout) clearTimeout(unchangedTimeout); };
  }, [targetContent, displayContent, isAILoading]);

  const markdownComponents = useMemo(() => {
    const isAtEnd = (node: any) => {
      if (hasFinishedTyping) return false;
      if (!node?.position?.end?.offset) return false;
      return node.position.end.offset >= displayContent.length - 1;
    };

    return {
      p: ({ node, children }: any) => {
        const inTable = useContext(InTableContext);
        const isStatus = typeof children === 'string' && (children.includes('Preparing tool') || children.includes('Thinking'));
        const atEnd = isAILoading && !hasFinishedTyping && !isStatus && !inTable && isAtEnd(node) && !!children;
        const isEmpty = !children || (Array.isArray(children) && children.length === 0) || (typeof children === 'string' && !children.trim());

        if (isStatus) {
          return (
            <div className="mb-0 font-sans font-medium opacity-30 text-[14px] tracking-[0] flex items-center">
              <StatusTyping text={children} />
              {atEnd && <span className="ai-cursor-inline">█</span>}
            </div>
          );
        }

        const childrenArray = React.Children.toArray(children);
        const isPureText = childrenArray.every(c => typeof c === 'string');
        const contentStr = isPureText ? childrenArray.join('') : '';
        const hasPotentialImage = isPureText && /!\[.*?\]\s*\(\s*(data:image\/|https?:\/\/|AUO)/.test(contentStr);

        if (isPureText && hasPotentialImage) {
          const imgMatch = contentStr.match(/!\[(.*?)\]\s*\(\s*(data:image\/.*?;base64,[\s\S]*?|https?:\/\/[\s\S]*?|AUO[\s\S]*?)(?:\s*\)|$)/);
          if (imgMatch) {
            const cleanSrc = imgMatch[2].trim().replace(/\s/g, '');
            const matchIndex = contentStr.indexOf(imgMatch[0]);
            const textBefore = contentStr.substring(0, matchIndex);
            const textAfter = contentStr.substring(matchIndex + imgMatch[0].length);
            
            return (
              <div className="mb-2 last:mb-0 break-words !max-w-full !w-full" style={{ fontFamily: '"Crimson Text"', fontWeight: 500, fontSize: '17px' }}>
                {textBefore && <span style={{ fontFamily: '"Crimson Text"', fontWeight: 500, fontSize: '17px' }}>{renderContentWithStyles(textBefore)}</span>}
                <ChatImage 
                  key={cleanSrc.substring(0, 32)} 
                  src={cleanSrc} 
                  alt={imgMatch[1] || ''} 
                  onHeightChange={scrollToBottom} 
                  onAddToWorkspace={() => handleAddImageToWorkspace(cleanSrc)} 
                />
                {textAfter && <span style={{ fontFamily: '"Crimson Text"', fontWeight: 500, fontSize: '17px' }}>{renderContentWithStyles(textAfter)}</span>}
                {(atEnd && !isEmpty) && <span className="ai-cursor-inline">█</span>}
              </div>
            );
          }
        }

        return (
          <div className="mb-2 last:mb-0 break-words !max-w-full !w-full" style={{ fontFamily: '"Crimson Text"', fontWeight: 500, fontSize: '17px' }}>
            {renderContentWithStyles(children)}
            {(atEnd && !isEmpty) && <span className="ai-cursor-inline">█</span>}
          </div>
        );
      },
      h1: ({ node, children }: any) => {
        const atEnd = isAILoading && !hasFinishedTyping && isAtEnd(node);
        return <h1 className="text-2xl font-bold mb-4 text-bone-100 mt-6 first:mt-0" style={{ fontFamily: '"Crimson Text"', fontSize: '28px' }}>{renderContentWithStyles(children)}{atEnd && <span className="ai-cursor-inline">█</span>}</h1>;
      },
      h2: ({ node, children }: any) => {
        const atEnd = isAILoading && !hasFinishedTyping && isAtEnd(node);
        return <h2 className="text-xl font-bold mb-3 text-bone-100 mt-5" style={{ fontFamily: '"Crimson Text"', fontSize: '24px' }}>{renderContentWithStyles(children)}{atEnd && <span className="ai-cursor-inline">█</span>}</h2>;
      },
      h3: ({ node, children }: any) => {
        const atEnd = isAILoading && !hasFinishedTyping && isAtEnd(node);
        return <h3 className="text-lg font-bold mb-2 text-bone-100 mt-4" style={{ fontFamily: '"Crimson Text"', fontSize: '20px' }}>{renderContentWithStyles(children)}{atEnd && <span className="ai-cursor-inline">█</span>}</h3>;
      },

      a: ({ href, children }: any) => {
        const isUrlOnly = typeof children === 'string' && (children.startsWith('http://') || children.startsWith('https://'));
        const isCitation = typeof children === 'string' && /^\[\d+\]$/.test(children);

        if (isCitation) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-3.5 h-3.5 -mt-2.5 ml-0.5 bg-white/10 hover:bg-white/20 rounded-full text-[8.5px] font-bold text-bone-100 no-underline align-super transition-all duration-200 select-none border border-white/5"
            >
              {children.replace(/[\[\]]/g, '')}
            </a>
          );
        }

        const label = isUrlOnly ? new URL(href).hostname.replace('www.', '') : children;
        let faviconUrl = '';
        try {
          if (href && href.startsWith('http')) {
            const urlObj = new URL(href);
            faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
          }
        } catch { }

        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 mt-1 mr-1.5 bg-white/5 hover:bg-white/10 rounded-full text-[11px] font-medium text-[var(--bone-30)] hover:text-bone-100 no-underline transition-all duration-200 select-none border border-white/5"
          >
            {faviconUrl && (
              <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0 overflow-hidden bg-white/10 rounded-[4px]">
                <img src={faviconUrl} alt="" className="w-3 h-3 object-contain select-none opacity-80" />
              </span>
            )}
            <span className="max-w-[120px] truncate leading-none font-medium">{label}</span>
          </a>
        );
      },
      strong: ({ node, children }: any) => {
        const start = node?.position?.start?.offset;
        const isSemibold = start !== undefined && targetContent.substring(start, start + 2) === '__';
        const inTable = !!useContext(InTableContext);
        return <strong className={clsx(isSemibold ? "font-semibold" : "font-bold")} style={!inTable ? { fontFamily: '"Crimson Text"', fontWeight: isSemibold ? 600 : 700 } : undefined}>{children}</strong>;
      },
      em: ({ children }: any) => {
        const inTable = !!useContext(InTableContext);
        return <em className="italic" style={!inTable ? { fontFamily: '"Crimson Text"' } : undefined}>{children}</em>;
      },
      ul: ({ children, className: ulClassName }: any) => {
        const isTaskList = typeof ulClassName === 'string' && ulClassName.includes('contains-task-list');
        return <ul className={clsx("list-none space-y-[0.3rem] mb-4 last:mb-0", isTaskList ? "pl-1" : "pl-4")}>{children}</ul>;
      },
      ol: ({ children }: any) => <ol className="list-decimal space-y-[0.3rem] mb-4 last:mb-0 pl-5 marker:text-bone-60" style={{ fontFamily: '"Crimson Text"', fontWeight: 500, fontSize: '17px' }}>{children}</ol>,
      li: ({ children, checked, node, ...props }: any) => {
        const atEnd = isAILoading && !hasFinishedTyping && isAtEnd(node);
        
        // Detect checklist: react-markdown sets checked to true/false for task list items
        const checkedFromProp = checked === true || checked === false;
        
        // Fallback: scan children for an input[type=checkbox]
        const childArray = React.Children.toArray(children);
        const checkboxChild: any = childArray.find((child: any) => 
          child?.props?.type === 'checkbox' || 
          child?.type === 'input' ||
          (typeof child === 'object' && child?.props?.className?.includes?.('task-list'))
        );
        
        const isChecklist = checkedFromProp || !!checkboxChild;
        const isChecked = checked === true || checkboxChild?.props?.checked === true;

        // For checklist items, filter out the default checkbox input
        const filteredChildren = isChecklist
          ? childArray.filter((child: any) => {
              if (child?.props?.type === 'checkbox') return false;
              if (child?.type === 'input') return false;
              return true;
            })
          : children;

        const handleToggle = () => {
          if (!isChecklist) return;
          const offset = node?.position?.start?.offset;
          if (typeof offset !== 'number') return;
          
          // Count how many checkboxes exist before this one in the rendered content
          const textBefore = targetContent.slice(0, offset);
          const checkboxRegex = /(?:[-*+]|\d+\.)\s+\[[\sXx]\]/gi;
          const previousCheckboxes = textBefore.match(checkboxRegex) || [];
          const targetIndex = previousCheckboxes.length;
          
          console.log('[Checklist Toggle]', { offset, targetIndex, previousCheckboxes });
          
          const fullContent = msg.content || '';
          let matchCount = 0;
          
          const newContent = fullContent.replace(/(?:[-*+]|\d+\.)\s+\[([\sXx])\]/gi, (match, inner) => {
            if (matchCount === targetIndex) {
              matchCount++;
              const isCurrentlyChecked = inner.toLowerCase() === 'x';
              const toggleChar = isCurrentlyChecked ? ' ' : 'x';
              console.log('[Checklist Toggle] Flipping at match', matchCount - 1, 'from', isCurrentlyChecked, 'to', toggleChar);
              return match.replace(/\[[\sXx]\]/i, `[${toggleChar}]`);
            }
            matchCount++;
            return match;
          });
          
          if (newContent !== fullContent) {
            console.log('[Checklist Toggle] Update successful', newContent);
            const store = useStore.getState();
            store.setAIHistory(
              store.aiMessages.map(m => 
                m.id === msg.id ? { ...m, content: newContent } : m
              )
            );
          } else {
            console.log('[Checklist Toggle] Failed: Content did not change');
          }
        };

        return (
          <li className={clsx("flex items-start group/li list-none", isChecklist ? "gap-2.5" : "gap-2 pl-1")}>
            {isChecklist ? (
              <span className="shrink-0 mt-[3px] flex items-center justify-center" onClick={handleToggle}>
                <span className={clsx(
                  "w-[16px] h-[16px] rounded-[4px] border-[1.5px] flex items-center justify-center transition-all cursor-pointer",
                  isChecked 
                    ? "bg-white/20 border-white/40" 
                    : "border-white/20 hover:border-white/40"
                )}>
                  {isChecked && (
                    <Check className="w-[12px] h-[12px] text-bone-100" strokeWidth={3} />
                  )}
                </span>
              </span>
            ) : (
              <span className="text-bone-60/70 select-none shrink-0 w-[6px] h-[6px] rounded-full bg-bone-60/40 mt-[9px]" aria-hidden="true" />
            )}
            <div className="flex-1 min-w-0 leading-[1.6] font-medium tracking-[0] break-words !max-w-full !w-full text-bone-100/90" style={{ fontFamily: '"Crimson Text"', fontWeight: 500, fontSize: '17px' }}>
              {renderContentWithStyles(filteredChildren)}
              {atEnd && <span className="ai-cursor-inline ml-1">█</span>}
            </div>
          </li>
        );
      },
      input: ({ type }: any) => {
        // Suppress default markdown checkbox — we render our own in li
        if (type === 'checkbox') return null;
        return null;
      },
      blockquote: ({ children }: any) => (
        <blockquote className="border-l-4 border-white/10 pl-4 py-1 my-3 italic bg-white/5 rounded-r text-bone-60">
          {children}
        </blockquote>
      ),
      code: ({ node, inline, className, children, ...props }: any) => {
        const matchNote = /language-apply-note/.exec(className || '');
        const matchCanvas = /language-apply-canvas/.exec(className || '');
        
        if (!inline && matchNote) {
          return <ApplyNoteCard content={String(children).replace(/\n$/, '')} />;
        }
        if (!inline && matchCanvas) {
          return <ApplyCanvasCard content={String(children).replace(/\n$/, '')} />;
        }

        const atEnd = !hasFinishedTyping && isAtEnd(node);
        const inTable = !!useContext(InTableContext);

        if (inline || inTable) {
          return (
            <code className={clsx("bg-white/10 rounded px-1.5 py-0.5 text-[12px] font-mono tracking-[0] font-medium", inTable && "inline-flex px-1 py-0 leading-tight")} style={{ fontFamily: 'DM Mono' }} {...props}>
              {children}{atEnd && <span className="ai-cursor-inline">█</span>}
            </code>
          );
        }

        const matchLang = /language-(\w+)/.exec(className || '');
        const language = matchLang ? matchLang[1] : 'Code';
        const isMono = language !== 'markdown' && language !== 'text';

        return (
          <div className="my-3 w-full rounded-2xl overflow-hidden border border-white/10 bg-black/10 group/code">
            <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.03] border-b border-white/5 select-none">
              <span className="text-[10.5px] font-bold text-bone-60 uppercase tracking-widest font-sans">{language}</span>
              <button 
                onClick={() => navigator.clipboard.writeText(String(children).replace(/\n$/, ''))}
                className="flex items-center gap-1.5 text-[10.5px] font-semibold text-bone-40 hover:text-bone-100 transition-colors duration-200"
              >
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </button>
            </div>
            <pre className="p-4 overflow-x-auto m-0 bg-transparent">
              <code className={clsx("text-[13px] leading-relaxed font-mono", isMono ? "font-mono" : "font-sans")} style={isMono ? { fontFamily: 'DM Mono' } : undefined} {...props}>
                {children}{atEnd && <span className="ai-cursor-inline">█</span>}
              </code>
            </pre>
          </div>
        );
      },
      hr: () => <hr className="border-white/10 my-4" />,
      img: ({ src, alt }: any) => {
        if (!src) return null;
        // Clean up data URIs that might have been mangled by markdown parsing or sanitization
        const cleanSrc = src.trim().replace(/\n/g, '').replace(/\r/g, '');
        return <ChatImage src={cleanSrc} alt={alt || ''} onHeightChange={scrollToBottom} onAddToWorkspace={() => handleAddImageToWorkspace(cleanSrc)} />;
      },
      table: ({ children }: any) => (
        <InTableContext.Provider value={true}>
          <div className="overflow-x-auto my-3 border border-white/10 rounded-2xl w-full bg-black/10">
            <table className="w-full text-[13px] border-collapse font-sans">{children}</table>
          </div>
        </InTableContext.Provider>
      ),
      thead: ({ children }: any) => <thead className="border-b border-white/10 bg-white/[0.02]">{children}</thead>,
      tbody: ({ children }: any) => <tbody className="divide-y divide-white/[0.05]">{children}</tbody>,
      tr: ({ children }: any) => <tr className="hover:bg-white/[0.01] transition-colors">{children}</tr>,
      th: ({ children }: any) => <th className="px-3 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wider text-bone-40 font-sans">{children}</th>,
      td: ({ children }: any) => (
        <td className="px-3 py-2.5 text-bone-80/90 font-sans leading-snug first:font-semibold first:text-bone-100">
          {children}
        </td>
      ),
    };
  }, [scrollToBottom, handleAddImageToWorkspace, hasFinishedTyping, displayContent, isAILoading, targetContent]);

  async function submitFeedback(value: 'like' | 'dislike') {
    if (feedbackState === value) return
    setFeedbackState(value)
    const logId = msg.logId || (msg as any).log_id;
    if (!logId) return
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      const authUserId = session?.user?.id || '00000000-0000-0000-0000-000000000000'

      const currentMessages = useStore.getState().aiMessages || [];
      const msgIndex = currentMessages.findIndex(m => m.id === msg.id);
      const priorMessages = msgIndex !== -1 ? currentMessages.slice(0, msgIndex) : currentMessages;
      const priorHistory = priorMessages.map(m => ({
        role: m.role,
        content: m.content
      })).slice(-10);

      await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_log_id: logId,
          auth_user_id: authUserId,
          feedback: value,
          context_messages: {
            classify: (msg as any).classification_trace,
            routing: (msg as any).routing_trace,
            history: priorHistory
          }
        })
      })
    } catch { setFeedbackState(null) }
  }

  const isError = msg.role === 'assistant' && (msg.content || '').startsWith('Error:');

  if (msg.role === 'assistant' && !displayContent && !(isAILoading && isLast)) return null;

  if (isError) {
    const errorText = (msg.content || '').replace(/^Error:\s*/, '');
    return (
      <div className="flex flex-col gap-2 mb-2 items-start">
        <div className="flex gap-3 w-full items-start">
          {isLast && (
            <div className="w-8 h-8 shrink-0 flex items-center justify-center mt-1">
              <AIAvatar className="bg-red-400" />
            </div>
          )}
          <div
            className="max-w-[90%] px-5 py-3 text-[13.5px] leading-[133%] rounded-2xl bg-red-500/5 tracking-[0] break-words"
            style={{ background: 'color-mix(in srgb, var(--color-background) 92%, rgb(239 68 68) 8%)' }}
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-red-400/60 mb-2">System Alert</p>
            <p className="text-foreground/90 font-medium tracking-[0]">{errorText}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx(
      "flex flex-col group",
      msg.role === 'user' ? "items-end mb-4" : "items-start mb-0"
    )}>
      <div className={clsx(
        "flex gap-3 w-full items-start",
        msg.role === 'user' ? "flex-row-reverse" : "flex-row"
      )}>
        <div className={clsx(
          "flex flex-col min-w-0",
          msg.role === 'user' ? "items-end max-w-[90%]" : "items-start max-w-[99%] flex-1"
        )}>
          {msg.role === 'assistant' && isLast && !displayContent ? (
            <div className="flex items-center gap-2.5 h-5 select-none -ml-1 mb-1">
              <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                <AIAvatar isTyping={true} className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-2">
                <StatusTyping
                  text={(() => {
                    if (msg.pipelineSteps && msg.pipelineSteps.length > 0) {
                      const activeStep = msg.pipelineSteps.find(s => s.status === 'running') || msg.pipelineSteps[msg.pipelineSteps.length - 1];
                      if (activeStep) return activeStep.label || activeStep.goal;
                    }
                    const category = thinkingEnabled ? "THINKING" : "CLASSIFIER";
                    const custom = aiSessionContext?.status_messages?.[category];
                    if (custom) return `${custom.emoji} ${custom.label}`.trim();
                    return "Working";
                  })()}
                  className="font-medium text-[var(--bone-100)]"
                  style={{ fontFamily: '"Crimson Text"', fontWeight: 500, fontSize: '17px' }}
                />
                {elapsed > 0 && (
                  <span className="text-[12px] font-medium text-[var(--bone-30)] font-mono opacity-80 select-none mt-0.5">
                    {((elapsed / 1000).toFixed(1))}s
                  </span>
                )}
              </div>
            </div>
          ) : (
            <>
              {msg.role === 'assistant' && isLast && (
                <div className="w-5 h-5 shrink-0 flex items-center justify-center select-none mb-1 -ml-1">
                  <AIAvatar isTyping={!hasFinishedTyping && msg.role === 'assistant'} className="w-3.5 h-3.5" />
                </div>
              )}
              {!displayContent && msg.role === 'assistant' ? null : (
                msg.role === 'user' ? (
                  <div className="flex items-center gap-2 justify-end w-full">
                    <Tooltip content="Reply">
                      <button
                        onClick={() => onReply(msg)}
                        className="p-1 rounded-md hover:bg-[var(--bone-6)] text-[var(--bone-30)] hover:text-foreground transition-all duration-200 opacity-0 group-hover:opacity-100 shrink-0"
                      >
                        <CornerUpLeft strokeWidth={2} className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                    <div
                      className="leading-[133%] font-medium text-[17px] px-4 py-2.5 w-fit max-w-full overflow-hidden"
                      style={{ background: 'var(--bone-6)', borderRadius: '17px 17px 4px 17px', fontFamily: 'DM Sans', fontWeight: 500, fontSize: '14.5px' }}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="whitespace-pre-wrap break-all font-medium" style={{ fontFamily: 'DM Sans', fontWeight: 500, fontSize: '14.5px' }}>{targetContent}</div>
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {msg.attachments.map((att: AIAttachment, i: number) => (
                              <div
                                key={`${msg.id}-att-${i}`}
                                className="rounded-[var(--radius-small)] overflow-hidden bg-[var(--black-overlay)] group relative cursor-pointer transition-colors"
                                onClick={() => {
                                  if (att.type === 'image') {
                                    openModal({ kind: 'mediaViewer', url: att.url, mediaType: 'image' });
                                  } else {
                                    window.open(att.url, '_blank');
                                  }
                                }}
                              >
                                {att.type === 'image' ? (
                                  <img src={att.url} alt={att.name} className="max-w-[200px] max-h-[150px] object-cover group-hover:opacity-90" />
                                ) : att.type === 'audio' ? (
                                  <ChatAudioPlayer url={att.url} name={att.name} />
                                ) : (
                                  <div className="px-3 py-2 text-[10px] flex items-center gap-2 group-hover:text-bone-100 font-medium">
                                    <Paperclip strokeWidth={2} className="w-3 h-3 text-bone-60" />
                                    <span className="max-w-[120px] truncate">{att.name}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full">
                    {hasThinking && (
                      <div className="mb-3">
                        <button
                          onClick={() => setShowThinking(!showThinking)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-[12px] bg-[var(--bone-5)] hover:bg-[var(--bone-10)] text-[12px] font-medium text-[var(--bone-60)] hover:text-[var(--bone-90)] transition-all"
                        >
                          <Brain className={clsx("w-3.5 h-3.5", isAILoading && isLast ? "text-bone-100 animate-pulse" : "text-bone-60")} />
                          <span>{isAILoading && isLast ? 'Thinking...' : 'Show thinking'}</span>
                          <ChevronDown className={clsx("w-3.5 h-3.5 opacity-50 transition-transform", showThinking && "rotate-180")} />
                        </button>
                        {showThinking && (
                          <div className="mt-2 pl-3 ml-2 border-l-2 border-white/20 pr-4 py-1">
                            <div className="text-[14.5px] italic text-[var(--bone-60)] leading-relaxed prose prose-invert !max-w-none prose-p:my-1 text-sm font-sans">
                              {thinkContent}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className={clsx(
                      "transition-all duration-500 min-h-[20px] flex flex-col",
                      isAILoading && isLast && !displayContent && "opacity-0"
                    )}>
                      {isPureImage ? (
                        <div className="w-full">
                          {(() => {
                            const imgMatch = displayContent.match(/!\[(.*?)\]\s*\(\s*(data:image\/.*?;base64,[\s\S]*?|https?:\/\/[\s\S]*?|AUO[\s\S]*?)(?:\s*\)|$)/);
                            if (imgMatch) {
                              const cleanSrc = imgMatch[2].trim().replace(/\s/g, '');
                              return (
                                <ChatImage 
                                  src={cleanSrc} 
                                  alt={imgMatch[1] || ''} 
                                  onHeightChange={scrollToBottom} 
                                  onAddToWorkspace={() => handleAddImageToWorkspace(cleanSrc)} 
                                />
                              );
                            }
                            return null;
                          })()}
                          {isAILoading && isLast && <span className="ai-cursor-inline ml-1">█</span>}
                        </div>
                      ) : (
                        <div className={clsx(
                          "prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/30 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-[14px]",
                          "prose-headings:font-bold prose-headings:text-bone-100 prose-p:text-bone-80 prose-strong:text-bone-100",
                          "prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline",
                          "prose-code:text-emerald-300 prose-code:bg-emerald-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none",
                          "prose-blockquote:border-l-emerald-500/50 prose-blockquote:bg-emerald-500/5 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg",
                          "w-full overflow-hidden relative [&_p]:my-0 break-words",
                          !hasFinishedTyping && msg.role === 'assistant' && "prose-streaming"
                        )} style={{ fontFamily: '"Crimson Text"', fontSize: '17px', fontWeight: 500 }}>
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={markdownComponents as any}
                          >
                            {displayContent}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>

                    {(hasFinishedTyping || msg.model) && (
                      <div className={clsx(
                        "flex flex-col gap-3 mt-1 transition-all duration-200",
                        !isLast && "opacity-0 group-hover:opacity-100"
                      )}>
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2 pt-3 border-t border-white/5 w-full">
                            <div className="w-full flex items-center gap-2 mb-1">
                              <Paperclip strokeWidth={2} className="w-3 h-3 text-[var(--bone-40)]" />
                              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--bone-40)]">Sources</p>
                            </div>
                            {msg.citations.slice(0, 8).map((url, i) => {
                              let domain = '';
                              try { domain = new URL(url).hostname.replace('www.', ''); } catch { }
                              let faviconUrl = '';
                              try { faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`; } catch { }

                              return (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-medium text-[var(--bone-60)] hover:text-bone-100 transition-all duration-200 max-w-[160px] truncate"
                                >
                                  <span className="w-3.5 h-3.5 flex items-center justify-center bg-white/5 rounded text-[8px] font-bold shrink-0 opacity-40">{i + 1}</span>
                                  {faviconUrl && (
                                    <img src={faviconUrl} alt="" className="w-3 h-3 object-contain opacity-60" />
                                  )}
                                  <span className="truncate">{domain || 'Source'}</span>
                                </a>
                              );
                            })}
                          </div>
                        )}

                        <div className="flex items-center gap-1">
                          {hasFinishedTyping && (
                            <>
                              <Tooltip content="Copy Text">
                                <button
                                  onClick={() => navigator.clipboard.writeText(displayContent)}
                                  className="p-0.5 rounded-md hover:bg-[var(--bone-6)] text-[var(--bone-30)] hover:text-foreground transition-colors"
                                >
                                  <Copy strokeWidth={2} className="w-3 h-3" />
                                </button>
                              </Tooltip>
                              <Tooltip content="Good response">
                                <button
                                  onClick={() => submitFeedback('like')}
                                  className={clsx("p-0.5 rounded-md hover:bg-[var(--bone-6)] transition-colors", feedbackState === 'like' ? "text-green-400" : "text-[var(--bone-30)] hover:text-foreground")}
                                >
                                  <ThumbsUp strokeWidth={2} className="w-3 h-3" />
                                </button>
                              </Tooltip>
                              <Tooltip content="Bad response">
                                <button
                                  onClick={() => submitFeedback('dislike')}
                                  className={clsx("p-0.5 rounded-md hover:bg-[var(--bone-6)] transition-colors", feedbackState === 'dislike' ? "text-red-400" : "text-[var(--bone-30)] hover:text-foreground")}
                                >
                                  <ThumbsDown strokeWidth={2} className="w-3 h-3" />
                                </button>
                              </Tooltip>
                              {isLast && onRegenerate && (
                                <Tooltip content="Regenerate">
                                  <button
                                    onClick={onRegenerate}
                                    className="p-0.5 rounded-md hover:bg-[var(--bone-6)] text-[var(--bone-30)] hover:text-foreground transition-colors"
                                  >
                                    <RotateCcw strokeWidth={2} className="w-3 h-3" />
                                  </button>
                                </Tooltip>
                              )}
                              <Tooltip content="Reply">
                                <button
                                  onClick={() => onReply(msg)}
                                  className="p-0.5 rounded-md hover:bg-[var(--bone-6)] text-[var(--bone-30)] hover:text-foreground transition-colors"
                                >
                                  <CornerUpLeft strokeWidth={2} className="w-3.5 h-3.5" />
                                </button>
                              </Tooltip>
                              
                              {/* Copy to Note Split Button */}
                              <div className="h-3 w-[1px] bg-white/5 mx-0.5" />
                              <div className="flex items-center gap-0 relative h-6 border border-white/5 rounded-md overflow-hidden bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
                                <Tooltip content={isNoteActive ? "Append to active note" : "No active note to append"}>
                                  <button
                                    onClick={() => handleCopyToNote(false)}
                                    disabled={!isNoteActive}
                                    className={clsx(
                                      "h-full px-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--bone-40)] hover:text-bone-100 transition-colors border-r border-white/5",
                                      !isNoteActive && "opacity-30 cursor-not-allowed"
                                    )}
                                  >
                                    <FileText className="w-2.5 h-2.5" />
                                    <span>Note</span>
                                  </button>
                                </Tooltip>
                                <DropdownMenu.Root>
                                  <DropdownMenu.Trigger asChild>
                                    <button className="h-full px-1 text-[var(--bone-30)] hover:text-bone-100 hover:bg-white/5 transition-colors flex items-center justify-center outline-none">
                                      <ChevronDown className="w-2.5 h-2.5" />
                                    </button>
                                  </DropdownMenu.Trigger>
                                  <DropdownMenu.Portal>
                                    <DropdownMenu.Content 
                                      className="z-50 min-w-[160px] bg-[#0e0e0e] border border-white/10 p-1 rounded-md animate-in fade-in-80 zoom-in-95 duration-100"
                                      align="end"
                                      sideOffset={5}
                                    >
                                      <DropdownMenu.Item 
                                        onSelect={() => handleCopyToNote(true)}
                                        className="flex items-center gap-2 px-2 py-1.5 text-[11px] font-medium text-bone-80 hover:text-bone-100 hover:bg-white/5 rounded cursor-pointer select-none outline-none"
                                      >
                                        <ClipboardCopy className="w-3.5 h-3.5" />
                                        <span>Create New Note</span>
                                      </DropdownMenu.Item>
                                    </DropdownMenu.Content>
                                  </DropdownMenu.Portal>
                                </DropdownMenu.Root>
                              </div>
                            </>
                          )}

                          {msg.model && (
                            <div className={clsx(
                              "flex items-center px-2 py-0.5 rounded-full bg-[var(--bone-6)] opacity-40 hover:opacity-100 transition-all duration-300",
                              hasFinishedTyping ? "ml-1" : "ml-0"
                            )}>
                              <span className="text-[8px] font-bold uppercase tracking-[0.05em] text-[var(--bone-40)]">
                                {msg.model ? msg.model.split('/').pop()?.replace(/-/g, ' ') : 'Model'}
                                {completionTime ? ` ${(completionTime / 1000).toFixed(1)}s` : ''}
                                {msg.tokens_used ? ` · ${msg.tokens_used} tokens` : ''}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});
ChatMessage.displayName = 'ChatMessage';
