"use client";

import { memo, useState, useRef, useEffect, useMemo } from 'react';
import { Copy, ThumbsUp, ThumbsDown, RotateCcw, Paperclip } from 'lucide-react';
import { useStore } from '@/data/store';
import type { AIMessage, AIAttachment } from '@/data/store';
import ReactMarkdown from 'react-markdown';
import { Tooltip } from '../../layout/Tooltip';
import { AIAvatar } from './AIAvatar';
import { StatusTyping } from './StatusTyping';
import { ChatImage } from './ChatImage';
import { ChatAudioPlayer } from './ChatAudioPlayer';
import clsx from 'clsx';

// Pre-compiled regexes
const THINK_TAG_FULL = /<think>[\s\S]*?<\/think>/g;
const THINK_TAG_PARTIAL = /<think>[\s\S]*$/;
const ALL_TOOLS_FULL_REGEX = /(?:!function_call:)?(add_note|add_folder|add_canvas|update_note_content|append_note_content|generate_image|web_search|delete_entity|rename_entity|add_task|delete_task|complete_task|update_task|move_entity|navigate_to|read_note|sort_entities)\s*\{[\s\S]*?\}/g;
const ALL_TOOLS_REGEX = /(add_note|add_folder|add_canvas|update_note_content|append_note_content|generate_image|web_search|delete_entity|rename_entity|add_task|delete_task|complete_task|update_task|move_entity|navigate_to|read_note|sort_entities)\s*\{[\s\S]*$/;

export const sanitizeContent = (content: string, isAILoading: boolean, isLastMessage: boolean) => {
  if (!content) return "";
  let text = content;

  text = text.replace(THINK_TAG_FULL, '');
  if (isAILoading && isLastMessage) {
    text = text.replace(THINK_TAG_PARTIAL, '');
  }

  text = text.replace(ALL_TOOLS_FULL_REGEX, "");

  // Filter out internal reasoning patterns (e.g., *Neutrality:*, *Final version plan:*)
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

  text = text.replace(/```json[\s\S]*?\{[\s\S]*?"(tool_code|action|method)"[\s\S]*?\}[\s\S]*?```/g, '');
  text = text.replace(/\{[\s\n\r]*"(tool_code|action|method)"[\s\S]*?\}/g, '');
  text = text.replace(/(?<!!)(add_note|add_folder|add_canvas|add_task|update_note_content|append_note_content|generate_image)\s*\([\s\S]*?\);?/g, '');

  text = text.trim();

  if (text.startsWith('!function_call:') && text.endsWith('}')) return "";
  if (text === '}' || text === '{' || text === '!function_call:') return "";

  return text;
};

export const ChatMessage = memo(({
  msg,
  isAILoading,
  isLast,
  scrollToBottom,
  handleAddImageToWorkspace,
  onRegenerate
}: {
  msg: AIMessage;
  isAILoading: boolean;
  isLast: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  handleAddImageToWorkspace: (url: string) => void;
  onRegenerate?: () => void;
}) => {
  const openModal = useStore(state => state.openModal);

  const targetContent = useMemo(() => {
    let content = sanitizeContent(msg.content || '', isAILoading, isLast)
    if (msg.citations && msg.citations.length > 0) {
      msg.citations.forEach((url, i) => {
        const num = i + 1;
        const regex = new RegExp(`\\[${num}\\](?![\\(\\[])`, 'g');
        content = content.replace(regex, `[${num}](${url})`);
      });
    }
    return content;
  }, [msg.content, isAILoading, isLast, msg.citations]);

  const isImageContent = targetContent.startsWith('![');
  const isInitiallyFinished = isImageContent || !isLast || (!isAILoading && targetContent.length > 0);
  const [displayContent, setDisplayContent] = useState(isInitiallyFinished ? targetContent : '');
  const [hasFinishedTyping, setHasFinishedTyping] = useState(isInitiallyFinished);
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
      }
    }
  }, [msg.role, isLast, isAILoading, completionTime]);

  useEffect(() => {
    if (msg.role === 'user' || hasFinishedTyping || isImageContent) {
      setDisplayContent(targetContent);
      displayedLenRef.current = targetContent.length;
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

      const elapsed = lastTimeRef.current ? (now - lastTimeRef.current) : 1000;
      if (elapsed < currentInterval) {
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
  }, [targetContent, msg.role, isAILoading, hasFinishedTyping, isImageContent]);

  useEffect(() => {
    let unchangedTimeout: NodeJS.Timeout | null = null;
    if (targetContent.length === displayedLenRef.current && isAILoading) {
      unchangedTimeout = setTimeout(() => {
        setHasFinishedTyping(true);
      }, 1500);
    }
    return () => { if (unchangedTimeout) clearTimeout(unchangedTimeout); };
  }, [targetContent, displayContent, isAILoading]);

  const markdownComponents = useMemo(() => {
    const isAtEnd = (node: any) => {
      if (!node?.position?.end?.offset) return false;
      return node.position.end.offset >= displayContent.length;
    };

    return {
      p: ({ node, children }: any) => {
        const isStatus = typeof children === 'string' && (children.includes('Preparing tool') || children.includes('Thinking'));
        const atEnd = isAILoading && !hasFinishedTyping && !isStatus && isAtEnd(node) && !!children;
        const isEmpty = !children || (Array.isArray(children) && children.length === 0) || (typeof children === 'string' && !children.trim());

          return <div className={clsx(isStatus ? "mb-0" : "mb-2 last:mb-0 break-words !max-w-full !w-full", isStatus && "font-sans font-medium opacity-30 text-[14px] tracking-wide flex items-center")}>
          {isStatus ? <StatusTyping text={children} /> : children}
          {(atEnd && !isEmpty) && <span className="ai-cursor-inline">█</span>}
        </div>;
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
              className="inline-flex items-center justify-center w-3.5 h-3.5 -mt-2.5 ml-0.5 bg-accent/10 hover:bg-accent/20 rounded-full text-[8.5px] font-bold text-accent no-underline align-super transition-all duration-200 select-none"
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
            className="inline-flex items-center gap-1.5 px-2.5 py-1 mt-1 mr-1.5 bg-white/5 hover:bg-white/10 rounded-full text-[11px] font-medium text-[var(--bone-30)] hover:text-accent no-underline transition-all duration-200 select-none"
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
        const atEnd = !hasFinishedTyping && isAtEnd(node);
        return <strong className="font-bold">{children}{atEnd && <span className="ai-cursor-inline">█</span>}</strong>;
      },
      ul: ({ children }: any) => <ul className="list-none space-y-2 mb-4 last:mb-0 pl-1">{children}</ul>,
      li: ({ node, children }: any) => {
        const atEnd = !hasFinishedTyping && isAtEnd(node);
        return (
          <li className="flex items-start gap-2.5">
            <span className="text-accent select-none shrink-0 mt-[0.45em] flex items-center justify-center leading-none" aria-hidden="true">•</span>
              <div className="flex-1 min-w-0 leading-relaxed font-medium text-[13.5px] tracking-wide break-words !max-w-full !w-full">
              {children}
              {atEnd && <span className="ai-cursor-inline">█</span>}
            </div>
          </li>
        );
      },
      code: ({ node, children }: any) => {
        const atEnd = !hasFinishedTyping && isAtEnd(node);
        return <code className="bg-white/10 rounded px-1.5 py-0.5 text-[12px] font-mono tracking-wide font-medium">{children}{atEnd && <span className="ai-cursor-inline">█</span>}</code>;
      },
      hr: () => <hr className="border-inner my-4" />,
      img: ({ src, alt }: any) => src ? <ChatImage src={src} alt={alt || ''} onHeightChange={scrollToBottom} onAddToWorkspace={() => handleAddImageToWorkspace(src)} /> : null
    };
  }, [scrollToBottom, handleAddImageToWorkspace, hasFinishedTyping, displayContent.length]);

  const isStatusOnly = useMemo(() =>
    msg.role === 'assistant' && isLast && isAILoading && (!displayContent || displayContent === 'Preparing tool...')
    , [msg.role, isLast, isAILoading, displayContent]);

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
              className="max-w-[90%] px-5 py-3 text-[13.5px] leading-relaxed rounded-2xl bg-red-500/5 shadow-lg shadow-red-500/5 tracking-wide break-words"
              style={{ background: 'color-mix(in srgb, var(--color-background) 92%, rgb(239 68 68) 8%)' }}
            >
            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-red-400/60 mb-2">System Alert</p>
            <p className="text-foreground/90 font-medium tracking-wide">{errorText}</p>
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
        {msg.role === 'assistant' && isLast && (
          <div className="w-5 h-5 shrink-0 flex items-center justify-center mt-[5.5px] -ml-1 select-none">
            <AIAvatar isTyping={!hasFinishedTyping && msg.role === 'assistant'} className="w-3.5 h-3.5" />
          </div>
        )}
         <div className={clsx(
           "flex flex-col min-w-0",
           msg.role === 'user' ? "items-end max-w-[90%]" : "items-start max-w-[90%] flex-1"
         )}>
          {!displayContent && msg.role === 'assistant' ? (
             <div className="flex items-center h-5 mt-[5.5px] gap-2">
               <StatusTyping
                 text="thinking"
                 className="font-mono font-medium text-[var(--bone-100)] text-[14.5px]"
               />
{elapsed > 0 && (
                  <span className="text-[12px] font-medium text-[var(--bone-30)] font-mono opacity-80 select-none mt-0.5">
                    {((elapsed / 1000).toFixed(1))}s
                  </span>
                )}
             </div>
          ) : (
<div
                className={clsx(
                  "leading-relaxed font-medium text-[14.5px]",
                  msg.role === 'user' ? "px-4 py-2.5 w-fit max-w-full overflow-hidden" : "px-0 py-1 w-full",
                  isStatusOnly && "p-0! mt-1"
                )}

              style={msg.role === 'user'
                ? { background: 'var(--bone-6)', borderRadius: '18px 18px 4px 18px' }
                : { background: 'none' }
              }
            >
              {msg.role === 'user' ? (
                <div className="flex flex-col gap-3">
                  <div className="whitespace-pre-wrap break-all text-foreground/90 font-medium">{targetContent}</div>
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
                            <div className="px-3 py-2 text-[10px] flex items-center gap-2 group-hover:text-accent font-medium">
                              <Paperclip strokeWidth={2} className="w-3 h-3 text-accent" />
                              <span className="max-w-[120px] truncate">{att.name}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (() => {
                // Direct image rendering: bypass ReactMarkdown for generated images
                const imageMatch = displayContent.match(/^!\[([^\]]*)\]\((data:[^)]+|https?:\/\/[^\s)]+)\)$/)
                if (imageMatch) {
                  return <ChatImage
                    src={imageMatch[2]}
                    alt={imageMatch[1]}
                    onHeightChange={scrollToBottom}
                    onAddToWorkspace={() => handleAddImageToWorkspace(imageMatch[2])}
                  />
                }
                return (
                    <div className={clsx("prose prose-invert !max-w-none !w-full relative [&_p]:my-0 break-words", !hasFinishedTyping && msg.role === 'assistant' && "prose-streaming")}>
                    <ReactMarkdown components={markdownComponents}>
                      {displayContent}
                    </ReactMarkdown>
                  </div>
                )
              })()}

            </div>
          )}

          {msg.role === 'assistant' && displayContent && (hasFinishedTyping || msg.model) && (
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
                        className="flex items-center gap-2 px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-medium text-[var(--bone-60)] hover:text-accent transition-all duration-200 max-w-[160px] truncate"
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
                    <Tooltip content="Copy">
                      <button
                        onClick={() => navigator.clipboard.writeText(displayContent)}
                        className="p-0.5 rounded-md hover:bg-[var(--bone-6)] text-[var(--bone-30)] hover:text-[var(--bone-30)] transition-colors"
                      >
                        <Copy strokeWidth={2} className="w-3 h-3" />
                      </button>
                    </Tooltip>
                    <Tooltip content="Good response">
                      <button
                        onClick={() => submitFeedback('like')}
                        className={clsx("p-0.5 rounded-md hover:bg-[var(--bone-6)] transition-colors", feedbackState === 'like' ? "text-green-400" : "text-[var(--bone-30)] hover:text-[var(--bone-30)]")}
                      >
                        <ThumbsUp strokeWidth={2} className="w-3 h-3" />
                      </button>
                    </Tooltip>
                    <Tooltip content="Bad response">
                      <button
                        onClick={() => submitFeedback('dislike')}
                        className={clsx("p-0.5 rounded-md hover:bg-[var(--bone-6)] transition-colors", feedbackState === 'dislike' ? "text-red-400" : "text-[var(--bone-30)] hover:text-[var(--bone-30)]")}
                      >
                        <ThumbsDown strokeWidth={2} className="w-3 h-3" />
                      </button>
                    </Tooltip>
                    {isLast && onRegenerate && (
                      <Tooltip content="Regenerate">
                        <button
                          onClick={onRegenerate}
                          className="p-0.5 rounded-md hover:bg-[var(--bone-6)] text-[var(--bone-30)] hover:text-[var(--bone-30)] transition-colors"
                        >
                          <RotateCcw strokeWidth={2} className="w-3 h-3" />
                        </button>
                      </Tooltip>
                    )}
                  </>
                )}

                {msg.model && (
                  <div className={clsx(
                    "flex items-center px-2 py-0.5 rounded-full bg-[var(--bone-6)] opacity-40 hover:opacity-100 transition-all duration-300",
                    hasFinishedTyping ? "ml-1" : "ml-0"
                  )}>
                    <span className="text-[8px] font-bold uppercase tracking-[0.05em] text-[var(--bone-40)]">
                      {msg.model.split('/').pop()?.replace(/-/g, ' ')}
                      {completionTime ? ` ${(completionTime / 1000).toFixed(1)}s` : ''}
                      {msg.tokens_used ? ` · ${msg.tokens_used} tokens` : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
ChatMessage.displayName = 'ChatMessage';
