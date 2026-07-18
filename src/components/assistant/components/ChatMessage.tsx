"use client";

import React, { memo, useState, useRef, useEffect, useMemo, createContext, useContext } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { Layout, Copy, ThumbsUp, ThumbsDown, RotateCcw, Paperclip, CornerUpLeft, FileText, File, ClipboardCopy, ChevronDown, ChevronRight, ChevronLeft, Sparkles, CheckCircle2, Brain, Check, ExternalLink, Folder, Frame, Box, Hash, Globe, Telescope, Image as ImageIcon } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../../ui/popover';
import { useStore, generateId } from '@/data/store';
import type { AIMessage, AIAttachment, EditorBlock } from '@/data/store';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Tooltip } from '../../layout/Tooltip';
import { AIAvatar } from './AIAvatar';
import { StatusTyping } from './StatusTyping';
import { ChatImage } from './ChatImage';
import { ChatAudioPlayer } from './ChatAudioPlayer';
import { useWordReveal } from '../hooks/useWordReveal';
import { deferIncompleteBlock } from '../utils/deferIncompleteBlock';
import { cn } from '@/lib/utils';
import { DEFAULT_STATUS_MESSAGES } from '@/lib/router-config';
import { getEntityIcon } from '@/data/icons';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';
import { parseMarkdownToBlocks } from '@/lib/editor/markdownBlocks';

const InTableContext = createContext(false);
const InHeaderContext = createContext(false);
const InListContext = createContext(false);
const ListTypeContext = createContext<'ul' | 'ol' | null>(null);

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

// Matches one [pill:Title](url) token. The URL group balances one level of
// parens (e.g. wikipedia.org/wiki/Foo_(bar)) so those citations aren't truncated.
const SINGLE_PILL_REGEX = /\[pill:([^\]]*)\]\(((?:[^()]|\([^()]*\))*)\)/g;

const getPillHostname = (urlStr: string): string => {
  if (!urlStr) return '';
  try {
    const cleanUrl = urlStr.startsWith('http://') || urlStr.startsWith('https://') ? urlStr : `https://${urlStr}`;
    return new URL(cleanUrl).hostname.replace('www.', '');
  } catch {
    return urlStr.trim().toLowerCase();
  }
};

// Drops repeat citations of a source already shown earlier in the same message —
// models tend to re-tag every sentence with the same pill instead of citing once.
// Dedup key is hostname (falls back to trimmed label) so different URLs on the
// same domain still collapse, matching how a reader perceives "the same source".
const dedupeCitationPills = (content: string): string => {
  if (!content || !content.includes('[pill:')) return content;
  const seen = new Set<string>();
  return content.replace(SINGLE_PILL_REGEX, (full, title, url) => {
    const key = getPillHostname(url) || title.trim().toLowerCase();
    if (!key || seen.has(key)) return '';
    seen.add(key);
    return full;
  });
};

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
        const activeColor = stack.find(s => s.startsWith('text-')) || 'text-[var(--bone-70)]';
        const isMono = stack.includes('font-mono');
        result.push(
          <span
            key={i}
            className={cn(
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
        stack.push('text-[var(--bone-70)]');
      } else if (part === '[/60]') {
        const idx = stack.lastIndexOf('text-[var(--bone-70)]');
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
        stack.push('text-[var(--bone-70)]');
      } else if (part === '[/a60]') {
        const idx = stack.lastIndexOf('text-[var(--bone-70)]');
        if (idx !== -1) stack.splice(idx, 1);
      } else {
        if (stack.length > 0) {
          const isMono = stack.includes('font-mono');
          result.push(
            <span
              key={i}
              className={cn(
                stack,
                isMono && "bg-[var(--app-dark)] rounded-[4px] px-1.5 py-[1px] mx-[1px] text-[calc(1em-1px)] text-[var(--bone-70)] tracking-tight font-medium"
              )}
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
  return /!\[.*?\]\s*\(\s*(data:image\/|https?:\/\/|\/|AUO)/.test(text);
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
  text = text.replace(/!\[.*?\]\s*\(\s*(data:image\/[\s\S]*?|https?:\/\/[\s\S]*?|\/[\s\S]*?|AUO[\s\S]*?)(?:\s+"[\s\S]*?")?\s*\)/g, (match) => {
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

  // Strip advisor pipeline metadata that sometimes leaks into displayed content
  text = text.replace(/---ADVISOR_STATE---[\s\S]*?---END_ADVISOR_STATE---/g, '');
  if (isAILoading && isLastMessage) {
    text = text.replace(/---ADVISOR_STATE---[\s\S]*$/, '');
  }
  // Remove leading "PASS" label emitted by the advisor when it decides to skip
  text = text.replace(/^\s*PASS\s*/i, '');

  // Remove search queries
  text = text.replace(/\[SEARCH\]\s*[^\n]*(?:\n+|$)/gi, '');

  text = text.replace(ALL_TOOLS_FULL_REGEX, "");

  // Strip XML tool tags from the UI so the user only sees the final response
  const XML_TOOLS_REGEX = /<(create_note|edit_note|delete_entity|move_entity|read_tasks|read_workspace_content|read_all_content|web_search|deep_research|generate_image|read_workspace|add_task|edit_canvas|create_canvas|edit_task|create_workspace)[^>]*>([\s\S]*?)<\/\1>|<(create_note|edit_note|delete_entity|move_entity|read_tasks|read_workspace_content|read_all_content|web_search|deep_research|generate_image|read_workspace|add_task|edit_canvas|create_canvas|edit_task|create_workspace)[^>]*\/>/gi;
  text = text.replace(XML_TOOLS_REGEX, "");

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

  // Positive math signal: equation operators, sub/superscripts, math operators.
  // If any of these is present, content is almost certainly math, not code.
  const MATH_SIGNAL = /[=≈≠≤≥]|[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ⁻⁺]|[₀-₉ₙₐₓᵢⱼ]|[·×÷±→⇒⇔√∞∑∏∫∂∈∉⊂⊃∪∩]|[\^_][0-9a-zA-Z(]/;

  const looksLikeMath = (s: string): boolean => MATH_SIGNAL.test(s.trim());

  // Heuristic: does content look like a math expression rather than real code?
  const looksLikeMathOrPlain = (s: string): boolean => {
    const t = s.trim();
    if (!t) return false;
    // Real code indicators
    if (/[;]/.test(t)) return false;
    if (/\b(function|const|let|var|def |import |class |return|public|private|async|await|=>)\b/.test(t)) return false;
    // Multi-line indented = real code structure
    if (t.includes('\n') && t.split('\n').filter((l: string) => /^[ \t]{2,}\S/.test(l)).length > 1) return false;
    return true;
  };

  // Unwrap fenced code blocks that contain only math/plain text (no real code).
  text = text.replace(/```(?:[a-z]*)[ \t]*([\s\S]*?)```/g, (match, inner) => {
    return looksLikeMathOrPlain(inner) ? inner.trim() : match;
  });

  // Unwrap inline code spans (`...`) that contain only math expressions.
  // Math always wins: if MATH_SIGNAL matches, strip backticks regardless of any
  // code-looking substring (e.g. "a₁ = a₁ + (n-1)d" contains no real code).
  text = text.replace(/`([^`\n]+)`/g, (match, inner: string) => {
    const t = inner.trim();
    if (looksLikeMath(t)) return t;
    // Below: content has no math signal — apply conservative code keep-rules.
    if (/[;]/.test(t)) return match;
    if (/\b(function|const|let|var|def |class |return|public|private|async|await|=>|null|undefined|true|false)\b/.test(t)) return match;
    if (/^\/|^\.\/|\.(ts|tsx|js|jsx|py|json|md|css|html|sh)$/.test(t)) return match;
    if (/^[a-z]+\s+--?[a-z]/i.test(t)) return match; // CLI command
    return t;
  });

  // Strip LaTeX math delimiters ($...$, $$...$$, \(...\), \[...\]) — models sometimes
  // ignore the Unicode-only instruction; bare content renders correctly without them.
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, '$1');
  text = text.replace(/\$([^$\n]+?)\$/g, '$1');
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, '$1');
  text = text.replace(/\\\(([^)]*?)\\\)/g, '$1');

  // Replace LaTeX command sequences with Unicode equivalents.
  text = text.replace(/\\implies\b/g, '⇒');
  text = text.replace(/\\Rightarrow\b/g, '⇒');
  text = text.replace(/\\rightarrow\b/g, '→');
  text = text.replace(/\\leftarrow\b/g, '←');
  text = text.replace(/\\Leftrightarrow\b/g, '⟺');
  text = text.replace(/\\iff\b/g, '⟺');
  text = text.replace(/\\cdot\b/g, '·');
  text = text.replace(/\\times\b/g, '×');
  text = text.replace(/\\div\b/g, '÷');
  text = text.replace(/\\pm\b/g, '±');
  text = text.replace(/\\approx\b/g, '≈');
  text = text.replace(/\\neq\b/g, '≠');
  text = text.replace(/\\leq\b/g, '≤');
  text = text.replace(/\\geq\b/g, '≥');
  text = text.replace(/\\infty\b/g, '∞');
  text = text.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');
  text = text.replace(/\\sqrt\[3\]\{([^}]+)\}/g, '∛($1)');
  text = text.replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, '$2^(1/$1)');
  text = text.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2');
  text = text.replace(/\\alpha\b/g, 'α');
  text = text.replace(/\\beta\b/g, 'β');
  text = text.replace(/\\gamma\b/g, 'γ');
  text = text.replace(/\\delta\b/g, 'δ');
  text = text.replace(/\\theta\b/g, 'θ');
  text = text.replace(/\\lambda\b/g, 'λ');
  text = text.replace(/\\mu\b/g, 'μ');
  text = text.replace(/\\pi\b/g, 'π');
  text = text.replace(/\\sigma\b/g, 'σ');
  text = text.replace(/\\omega\b/g, 'ω');
  text = text.replace(/\\Omega\b/g, 'Ω');
  text = text.replace(/\\Delta\b/g, 'Δ');
  text = text.replace(/\\Sigma\b/g, 'Σ');
  text = text.replace(/\\in\b/g, '∈');
  text = text.replace(/\\notin\b/g, '∉');
  text = text.replace(/\\subset\b/g, '⊂');
  text = text.replace(/\\cup\b/g, '∪');
  text = text.replace(/\\cap\b/g, '∩');
  text = text.replace(/\\forall\b/g, '∀');
  text = text.replace(/\\exists\b/g, '∃');
  text = text.replace(/\\partial\b/g, '∂');
  text = text.replace(/\\sum\b/g, '∑');
  text = text.replace(/\\prod\b/g, '∏');
  text = text.replace(/\\int\b/g, '∫');
  // \mathbf{x}, \text{x}, \mathrm{x}, \textbf{x}, \textit{x} etc. → keep content
  text = text.replace(/\\(?:mathbf|mathit|mathrm|mathsf|mathtt|text|textbf|textit|textrm|boldsymbol|hat|bar|vec|tilde|dot|ddot|overline|underline)\{([^}]*)\}/g, '$1');
  // 3. Restore protected images BEFORE LaTeX conversions that would mangle placeholders
  images.forEach((img, i) => {
    text = text.replace(`__IMG_PLACEHOLDER_${i}__`, () => img);
  });

  // Convert ^{...} and _{...} to Unicode super/subscripts where possible.
  const SUP_MAP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', 'n': 'ⁿ', 'a': 'ᵃ', 'b': 'ᵇ', 'i': 'ⁱ', 'j': 'ʲ', '+': '⁺', '-': '⁻', '(': '⁽', ')': '⁾' };
  const SUB_MAP: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', 'n': 'ₙ', 'a': 'ₐ', 'i': 'ᵢ', 'j': 'ⱼ' };
  const toSup = (s: string) => s.split('').map(c => SUP_MAP[c] ?? c).join('');
  const toSub = (s: string) => s.split('').map(c => SUB_MAP[c] ?? c).join('');
  // ^{expr} and ^single-char
  text = text.replace(/\^\{([^}]+)\}/g, (_, e) => toSup(e));
  text = text.replace(/\^([0-9a-zA-Z])/g, (_, c) => toSup(c));
  // _{expr} and _single-char (only when not already Unicode subscript)
  text = text.replace(/_\{([^}]+)\}/g, (_, e) => toSub(e));
  text = text.replace(/_([0-9a-zA-Z])/g, (_, c) => toSub(c));
  // Strip any remaining \command{content} — keep the content, drop the command
  text = text.replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1');
  // \, thin space (used in numbers like 86\,400) → nothing
  text = text.replace(/\\,/g, '');
  // Strip remaining bare \command sequences
  text = text.replace(/\\[a-zA-Z]+/g, '');

  // Collapse orphan arrow lines and bullets — models sometimes emit "→" alone
  // on its own line or as a sole-content bullet, fragmenting math derivations.
  // Merge "<line>\n→\n<line>" into "<line> → <line>".
  text = text.replace(/([^\n])\n[ \t]*(?:[-*+][ \t]+)?[→⇒]+[ \t]*\n[ \t]*(?:[-*+][ \t]+)?([^\n])/g, '$1 → $2');
  // Strip standalone bullet lines whose entire content is just an arrow.
  text = text.replace(/^[ \t]*[-*+][ \t]+[→⇒][ \t]*$/gm, '');
  // Collapse the resulting double blank lines.
  text = text.replace(/\n{3,}/g, '\n\n');

  // Escape lettered list markers (a), b), A), B) etc.) at line starts so remark-gfm
  // doesn't misparse them as ordered list items and render them as code blocks.
  text = text.replace(/^([a-zA-Z])\)/gm, '$1\\)');

  // Escape numeric ")"-style list markers at line start (1) Title, 2) Title) so
  // remark-gfm renders them as plain paragraphs, not as fresh ordered lists that
  // all restart at "1." — but DO NOT touch them inside markdown headings
  // (## 1), ### 2) etc., which remark already handles correctly).
  text = text.replace(/^(?!#{1,6}\s)(\d+)\)(\s)/gm, '$1\\)$2');

  text = text.trim();

  if (text.startsWith('!function_call:') && text.endsWith('}')) return "";
  if (text === '}' || text === '{' || text === '!function_call:') return "";

  return text;
};

export const stableAppendStreamingCursor = (content: string, showCursor = true): string => {
  if (!content) return showCursor ? "~~AICURSORZX~~" : '';

  const text = content;

  // 1. Track fenced code blocks (```)
  const codeBlockMatches = text.match(/```/g);
  const inCodeBlock = codeBlockMatches ? codeBlockMatches.length % 2 !== 0 : false;

  if (inCodeBlock) {
    const cursor = showCursor ? '~~AICURSORZX~~' : '';
    return text + cursor + '\n```';
  }

  // Helper to check if a character at index is escaped by backslashes
  const isEscaped = (idx: number): boolean => {
    let backslashes = 0;
    let j = idx - 1;
    while (j >= 0 && text[j] === '\\') {
      backslashes++;
      j--;
    }
    return backslashes % 2 !== 0;
  };

  // 2. Track inline tags: code (`), bold (** or __), italic (* or _)
  const stack: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (isEscaped(i)) {
      i++;
      continue;
    }

    if (text[i] === '`') {
      let count = 0;
      while (i < text.length && text[i] === '`') {
        count++;
        i++;
      }
      if (count > 0) {
        const tag = '`'.repeat(count);
        if (stack[stack.length - 1] === tag) {
          stack.pop();
        } else {
          stack.push(tag);
        }
      }
    } else if (text.startsWith('***', i)) {
      if (stack[stack.length - 1] === '***') stack.pop();
      else stack.push('***');
      i += 3;
    } else if (text.startsWith('**', i)) {
      if (stack[stack.length - 1] === '**') stack.pop();
      else stack.push('**');
      i += 2;
    } else if (text.startsWith('*', i)) {
      if (stack[stack.length - 1] === '*') stack.pop();
      else stack.push('*');
      i += 1;
    } else if (text.startsWith('___', i)) {
      if (stack[stack.length - 1] === '___') stack.pop();
      else stack.push('___');
      i += 3;
    } else if (text.startsWith('__', i)) {
      if (stack[stack.length - 1] === '__') stack.pop();
      else stack.push('__');
      i += 2;
    } else if (text.startsWith('_', i)) {
      if (stack[stack.length - 1] === '_') stack.pop();
      else stack.push('_');
      i += 1;
    } else {
      i++;
    }
  }

  const closingTags = [...stack].reverse().join('');
  const cursor = showCursor ? '~~AICURSORZX~~' : '';
  return text + cursor + closingTags;
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
    <div className="mt-4 mb-6 w-full p-4 rounded-[17px] bg-emerald-500/5 border border-emerald-500/20 relative overflow-hidden backdrop-blur-xl group">
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
            className={cn(
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
        <div className="w-full max-h-[140px] overflow-y-auto bg-panel p-3 rounded-[12px] text-[12.5px] font-medium leading-[133%] text-bone-100 font-sans border border-[var(--bone-6)] custom-scrollbar">
          <pre className="whitespace-pre-wrap font-sans text-bone-100 leading-[133%] font-medium w-full">{content}</pre>
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
          const newCanvasId = addEntity({ type: 'canvas', title: 'Applied Flow Space' });
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
    <div className="mt-4 mb-6 w-full p-4 rounded-[17px] bg-white/5 border border-white/10 relative overflow-hidden backdrop-blur-xl group">
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
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-bone-70">Proposed Canvas Update</p>
          </div>
          <button
            onClick={handleApply}
            className={cn(
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
        <div className="w-full max-h-[140px] overflow-y-auto bg-panel p-3 rounded-[12px] text-[12.5px] font-mono leading-[133%] text-bone-100 border border-[var(--bone-6)] custom-scrollbar">
          <pre className="whitespace-pre-wrap leading-[133%] font-medium w-full">{content}</pre>
        </div>
      </div>
    </div>
  );
};

export const getEntityIconReact = (type: string, iconName?: string) => {
  if (iconName) {
    const IconComp = getEntityIcon(iconName);
    if (iconName.length > 2) {
      // It's an icon name (not emoji) — use the Lucide component
      return <IconComp className="w-3.5 h-3.5 opacity-60" />;
    }
    // It's an emoji
    return <span className="font-emoji text-[12px] leading-none text-center">{iconName}</span>
  }
  
  if (type === 'workspace') return <Box className="w-3.5 h-3.5 opacity-60" />;
  switch (type) {
    case 'note': return <FileText className="w-3.5 h-3.5 opacity-60" />;
    case 'folder': return <Folder className="w-3.5 h-3.5 opacity-60" />;
    case 'canvas': return <Frame className="w-3.5 h-3.5 opacity-60" />;
    default: return <Hash className="w-3.5 h-3.5 opacity-60" />;
  }
}

export const parseMentions = (contentArray: any[], entities: any[], spaces: any[]) => {
  const allMentionables = [
    ...entities.filter(e => ['folder', 'note', 'canvas'].includes(e.type)).map(e => ({ title: e.title, type: e.type, id: e.id, icon: e.icon })),
    ...spaces.map(w => ({ title: w.name, type: 'workspace', id: w.id, icon: w.icon || (w.type === 'personal' ? 'User' : 'Box') }))
  ];
  allMentionables.sort((a, b) => (b.title || '').length - (a.title || '').length);

  let renderedContent: any[] = contentArray;
  for (const item of allMentionables) {
    if (!item.title) continue;
    const mentionText = `@${item.title.trim()}`;
    const regex = new RegExp(`(?<=\\s|^)(${mentionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=[\\s\\.,:;?!]|$)`, 'g');

    renderedContent = renderedContent.flatMap(part => {
      if (typeof part === 'string' && part.match(regex)) {
        const subParts = part.split(regex);
        const newParts: any[] = [];
        subParts.forEach((sub, i) => {
          if (sub === mentionText) {
            if (item.type === 'workspace') {
              newParts.push(
                <button
                  key={`${item.id}-${i}`}
                  className="inline-flex items-center gap-1.5 px-1.5 py-[1px] mx-[1px] rounded-[8px] bg-[var(--bone-6)] hover:bg-[var(--bone-10)] text-[var(--bone-100)] font-medium tracking-tight text-[13px] align-middle select-all transition-colors cursor-pointer"
                  onClick={() => useStore.getState().setActiveSpaceId(item.id)}
                  title={`Switch to ${item.title}`}
                >
                  {getEntityIconReact(item.type, item.icon)}<span>{item.title}</span>
                </button>
              );
            } else {
              newParts.push(
                <button
                  key={`${item.id}-${i}`}
                  className="inline-flex items-center gap-1.5 px-1.5 py-[1px] mx-[1px] rounded-[8px] bg-[var(--bone-6)] hover:bg-[var(--bone-10)] text-[var(--bone-100)] font-medium tracking-tight text-[13px] align-middle select-all transition-colors cursor-pointer"
                  onClick={() => useStore.getState().addTab(item.id)}
                  title={`Open ${item.title}`}
                >
                  {getEntityIconReact(item.type)}<span>{item.title}</span>
                </button>
              );
            }
          } else {
            newParts.push(sub);
          }
        });
        return newParts;
      }
      return part;
    });
  }
  return renderedContent;
};

const UserMessageBubble = ({
  msg,
  targetContent,
  compact,
  openModal,
}: {
  msg: AIMessage;
  targetContent: string;
  compact: boolean;
  openModal: (opts: any) => void;
}) => {
  const { resolvedTheme } = useTheme();
  const msgFontWeight = resolvedTheme === 'dark' ? 400 : 500;

  const entities = useStore(state => state.entities);
  const spaces = useStore(state => state.spaces);
  const renderedTargetContent = useMemo(() => parseMentions([targetContent], entities, spaces), [targetContent, entities, spaces]);

  return (
    <div className="flex flex-col items-end gap-1.5 max-w-full">
      {msg.intentTag && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-[6px] bg-[var(--app-dark)] border border-white/5 text-[var(--bone-60)] text-[11px] font-medium tracking-wide">
          {msg.intentTag === '/search' && <Globe className="w-3 h-3" />}
          {msg.intentTag === '/research' && <Telescope className="w-3 h-3" />}
          {msg.intentTag === '/image' && <ImageIcon className="w-3 h-3" />}
          <span>{msg.intentTag === '/search' ? 'Web Search' : msg.intentTag === '/research' ? 'Deep Research' : msg.intentTag === '/image' ? 'Image Generation' : msg.intentTag}</span>
        </div>
      )}
      <div className="flex items-end gap-2 max-w-full">
        <div
          className={cn("leading-[133%] px-5 py-3 w-fit max-w-full overflow-hidden text-[var(--bone-100)]", compact ? "text-[17px]" : "text-[20px]")}
          style={{ backgroundColor: 'var(--app-dark)', borderRadius: '12px', fontFamily: 'DM Sans', fontWeight: msgFontWeight, fontSize: compact ? '15px' : '17px' }}
        >
        <div className="flex flex-col gap-3">
          <div className="break-words whitespace-pre-wrap" style={{ fontFamily: 'DM Sans', fontWeight: msgFontWeight, fontSize: compact ? '15px' : '17px' }}>
            {renderedTargetContent.map((c, i) => <React.Fragment key={i}>{c}</React.Fragment>)}
          </div>
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {msg.attachments.map((att: AIAttachment, i: number) => (
                <div
                  key={`${msg.id}-att-${i}`}
                  className="rounded-[var(--radius-small)] overflow-hidden bg-[var(--black-overlay)] group/att relative cursor-pointer transition-colors"
                  onClick={() => {
                    if (att.type === 'image') {
                      openModal({ kind: 'mediaViewer', url: att.url, mediaType: 'image' });
                    } else {
                      window.open(att.url, '_blank');
                    }
                  }}
                >
                  {att.type === 'image' ? (
                    <img src={att.url} alt={att.name} className="max-w-[200px] max-h-[150px] object-cover group-hover/att:opacity-90" />
                  ) : att.type === 'audio' ? (
                    <ChatAudioPlayer url={att.url} name={att.name} />
                  ) : (
                    <div className="px-3 py-2 text-[10px] flex items-center gap-2 group-hover/att:text-bone-100 font-medium">
                      <Paperclip strokeWidth={2} className="w-3 h-3 text-bone-70" />
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
    </div>
  );
};

const LinkWithPopup = ({ href, children }: { href: string, children: any }) => {
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isHovering = useRef(false);
  const [copying, setCopying] = useState(false);

  const cancelClose = () => {
    isHovering.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsOpen(true);
  };

  const scheduleClose = () => {
    isHovering.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!isHovering.current) setIsOpen(false);
    }, 60);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(href).then(() => {
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    });
  };

  const isUrlOnly = typeof children === 'string' && (children.startsWith('http://') || children.startsWith('https://'));
  const label = isUrlOnly ? new URL(href).hostname.replace('www.', '') : children;

  // Inline pill always shows the site name (e.g. "Instagram", "Fortune"), never the
  // model-supplied article/blog title — that stays in `label` for the popup only.
  const getSiteName = (urlStr: string): string => {
    try {
      const cleanUrl = urlStr.startsWith('http://') || urlStr.startsWith('https://') ? urlStr : `https://${urlStr}`;
      let host = new URL(cleanUrl).hostname.replace(/^www\./, '');
      const parts = host.split('.');
      // Drop a leading language/subdomain segment (e.g. "en.wikipedia.org" -> "wikipedia")
      // and the TLD, keeping the registrable domain name (e.g. "developers.cloudflare.com" -> "cloudflare").
      const core = parts.length > 2 ? parts[parts.length - 2] : parts[0];
      return core.charAt(0).toUpperCase() + core.slice(1);
    } catch {
      return typeof children === 'string' ? children : '';
    }
  };
  const pillLabel = getSiteName(href);

  let faviconUrl = '';
  try {
    if (href && href.startsWith('http')) {
      const urlObj = new URL(href);
      faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
    }
  } catch { }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          className="inline-link-btn chat-citation-pill px-1.5 py-[1px] mx-1 inline-flex items-center rounded-full text-[10px] font-bold font-sans no-underline select-none align-baseline leading-tight"
        >
          <span className="max-w-[100px] truncate font-medium pointer-events-none">{pillLabel}</span>
        </a>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="z-[500] w-fit max-w-[320px] p-2 bg-[var(--app-panel)] border-[var(--bone-12)] shadow-2xl backdrop-blur-2xl rounded-xl border"
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5 px-1.5 py-1">
            {faviconUrl && (
              <span className="w-5 h-5 flex items-center justify-center shrink-0 rounded-md bg-[var(--bone-5)]">
                <img src={faviconUrl} alt="" className="w-3.5 h-3.5 object-contain" />
              </span>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-bold text-[var(--bone-100)] truncate max-w-[200px]">
                {label}
              </span>
              <span className="text-[9px] font-medium text-[var(--bone-30)] truncate max-w-[200px] font-sans">
                {href}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 border-t border-[var(--bone-6)] pt-1.5 mt-0.5">
            <Tooltip content={copying ? "Copied!" : "Copy Link"}>
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md hover:bg-[var(--bone-5)] text-[var(--bone-30)] hover:text-[var(--bone-100)] transition-colors"
              >
                {copying ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {copying ? "COPIED" : "COPY"}
                </span>
              </button>
            </Tooltip>
            <div className="w-px h-3 bg-[var(--bone-6)]" />
            <Tooltip content="Open in New Tab">
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md hover:bg-[var(--bone-5)] text-[var(--bone-30)] hover:text-[var(--bone-100)] transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Open</span>
              </a>
            </Tooltip>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const AdvisorCard = ({ content, state, compact = false }: { content: string; state: any; compact?: boolean }) => {
  return (
    <div className="w-full">
      <div className="flex items-center gap-1.5 mb-2 select-none">
        <div className="w-4 h-4 rounded-full bg-[var(--brand-blue)]/20 flex items-center justify-center">
          <Brain strokeWidth={2} className="w-2.5 h-2.5 text-[var(--brand-blue)]" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--bone-40)]">
          Advisor {state?.phase === 'ready' ? '· Ready' : `· Round ${state?.round || 1}`}
        </span>
        {state?.phase === 'planning' && (
          <span className="text-[10px] font-medium text-amber-400/70 ml-auto">Needs your input</span>
        )}
      </div>
      <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/30 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-[14px] prose-headings:font-bold prose-headings:text-bone-100 prose-p:text-bone-80 prose-strong:text-bone-100 prose-code:text-emerald-300 prose-code:bg-emerald-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none prose-blockquote:border-l-emerald-500/50 prose-blockquote:bg-emerald-500/5 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg w-full overflow-hidden [&_p]:my-0 break-words" style={{ fontFamily: 'var(--font-display)', fontSize: compact ? '13.5px' : '17px', fontWeight: 400, letterSpacing: '-0.01em', color: 'var(--bone-100)' }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
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
  onReply,
  compact = false,
  chatPageMode = false
}: {
  msg: AIMessage;
  isAILoading: boolean;
  isLast: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  handleAddImageToWorkspace: (url: string) => void;
  onRegenerate?: () => void;
  onReply: (msg: AIMessage) => void;
  compact?: boolean; chatPageMode?: boolean;
}) => {
  if (msg.role === 'system') {
    return (
      <div className="flex justify-center w-full my-6">
        <span className="text-[12px] uppercase tracking-widest text-[var(--bone-40)] font-medium">
          {msg.content}
        </span>
      </div>
    );
  }

  const openModal = useStore(state => state.openModal);
  const activeEntityId = useStore(state => state.activeEntityId);
  const entities = useStore(state => state.entities);
  const addEntity = useStore(state => state.addEntity);
  const updateEntityContent = useStore(state => state.updateEntityContent);
  const setActiveEntityId = useStore(state => state.setActiveEntityId);
  const setVariantIndex = useStore(state => state.setVariantIndex);
  const aiSessionContext = useStore(state => state.aiSessionContext);
  const isChatNewNoteButtonVisible = useStore(state => state.isChatNewNoteButtonVisible);

  const variants = msg.variants ?? [];
  const totalVariants = variants.length;
  const currentVariantIndex = msg.variantIndex ?? 0;

  const activeNote = useMemo(() => activeEntityId ? entities.find(e => e.id === activeEntityId) : null, [activeEntityId, entities]);
  const isNoteActive = activeNote?.type === 'note';

  const handleCopyToNote = (asNew: boolean = false) => {
    const cleanContent = sanitizeContent(msg.content || '', false, false);
    const blocks = parseMarkdownToBlocks(cleanContent);

    // Scan the parsed blocks to check which URLs have already been rendered as inline links
    const seenUrls = new Set<string>();
    const scanBlockForUrls = (b: EditorBlock) => {
      if (b.content) {
        const urlRegex = /href="([^"]+)"/g;
        let match;
        while ((match = urlRegex.exec(b.content)) !== null) {
          const matchedUrl = match[1].replace(/&amp;/g, '&');
          seenUrls.add(matchedUrl);
          seenUrls.add(match[1]);
        }
      }
      if (b.children) {
        b.children.forEach(scanBlockForUrls);
      }
    };
    blocks.forEach(scanBlockForUrls);

    // Append any citation sources that weren't already rendered inline
    const remainingCitations = (msg.citations || []).filter(url => !seenUrls.has(url));

    if (remainingCitations.length > 0) {
      const sourceButtonsHtml = remainingCitations.map(url => {
        let domain = 'Source';
        try { domain = new URL(url).hostname.replace('www.', ''); } catch { }

        let faviconUrl = '';
        try {
          faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;
        } catch (e) { }

        const faviconHtml = faviconUrl
          ? `<span class="w-3.5 h-3.5 flex items-center justify-center shrink-0 overflow-hidden rounded-[4px] pointer-events-none"><img src="${faviconUrl}" class="w-3 h-3 object-contain select-none opacity-80" alt="" /></span>`
          : `<span class="w-3.5 h-3.5 flex items-center justify-center shrink-0 overflow-hidden pointer-events-none"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link w-3 h-3 text-[var(--bone-100)] opacity-60 shrink-0 pointer-events-none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg></span>`;

        return `<a href="${url}" class="inline-link-btn px-2 py-0.5 mx-1 inline-flex items-center gap-1.5 bg-panel hover:bg-[var(--bone-5)] rounded-full text-[11px] font-bold font-sans text-[var(--bone-70)] hover:text-[var(--bone-100)] no-underline select-none border border-[var(--bone-10)] align-baseline" contenteditable="false" data-url="${url}" data-label="${domain}">${faviconHtml}<span class="max-w-[120px] truncate font-medium pointer-events-none">${domain}</span></a>`;
      }).join(' ');

      blocks.push({
        id: generateId(),
        type: 'text',
        content: sourceButtonsHtml,
        style: 'body'
      });
    }

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
    // 1. Extract from pipeline steps (Orchestrator thinking)
    if (msg.pipelineSteps && msg.pipelineSteps.length > 0) {
      const thinkStep = msg.pipelineSteps.find(s => s.chain === 'THINKING' && s.output);
      if (thinkStep) return thinkStep.output;
    }

    // 2. Extract from message content (Model-native thinking like R1)
    if (!msg.content) return '';
    const matchFull = msg.content.match(THINK_TAG_FULL);
    if (matchFull) return matchFull[0].replace(/<\/?think>/g, '').trim();
    if (isAILoading && isLast) {
      const matchPartial = msg.content.match(THINK_TAG_PARTIAL);
      if (matchPartial) return matchPartial[0].replace(/<think>/, '').trim();
    }
    return '';
  }, [msg.content, msg.pipelineSteps, isAILoading, isLast]);

  const hasThinking = !!thinkContent;
  const [showThinking, setShowThinking] = useState(false);

  // Auto-expand thinking during live generation only when the user has opted in
  useEffect(() => {
    if (isAILoading && isLast && !!thinkContent && !showThinking && thinkingEnabled) {
      setShowThinking(true);
    }
  }, [!!thinkContent, isAILoading, isLast, thinkingEnabled]);

  const isImageContent = looksLikeImageContent(targetContent);
  const isPureImage = useMemo(() => {
    if (!targetContent) return false;
    const trimmed = targetContent.trim();
    return /^!\[.*?\]\s*\(\s*(data:image\/|https?:\/\/|\/|AUO)[\s\S]*?(\s+"[\s\S]*?")?\s*(\s*\)|$)/.test(trimmed);
  }, [targetContent]);
  const safeContent = useMemo(
    () => deferIncompleteBlock(targetContent, !isAILoading),
    [targetContent, isAILoading]
  );

  const { revealedText, isRevealing } = useWordReveal(safeContent, {
    enabled: isLast && !msg.hasRevealed,
    initialProgress: isAILoading ? 'zero' : 'complete',
  });

  const markMessageRevealed = useStore(state => state.markMessageRevealed);
  useEffect(() => {
    if (!isAILoading && !isRevealing && !msg.hasRevealed && msg.id) {
      markMessageRevealed(msg.id);
    }
  }, [isAILoading, isRevealing, msg.hasRevealed, msg.id, markMessageRevealed]);

  const displayContent = useMemo(() => {
    if (isPureImage) return targetContent;

    if (isLast && targetContent) {
      if (isAILoading) {
        return stableAppendStreamingCursor(revealedText, true);
      }
      if (isRevealing) {
        return stableAppendStreamingCursor(revealedText, false);
      }
    }

    return targetContent;
  }, [targetContent, isAILoading, isLast, isPureImage, revealedText, isRevealing]);

  // Rendering-only cleanup: collapse repeat citation pills for the same source.
  // Safe to run mid-stream too — the regex only matches complete [pill:...](...)
  // tokens, so an in-flight partial pill at the tail is simply left untouched.
  const renderedDisplayContent = useMemo(() => {
    if (isPureImage) return displayContent;
    return dedupeCitationPills(displayContent);
  }, [displayContent, isPureImage]);
  const [feedbackState, setFeedbackState] = useState<'like' | 'dislike' | null>(null);


  const [elapsed, setElapsed] = useState(0)
  const [completionTime, setCompletionTime] = useState<number | null>(null)
  const timerStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (msg.role === 'assistant') {
      if (isAILoading && isLast) {
        if (!timerStartRef.current) {
          timerStartRef.current = msg.timestamp || Date.now();
        }
        // Set the first value synchronously so the timer text appears on the
        // same paint as the status row, instead of waiting ~100ms for the
        // first interval tick (visible as a delayed pop-in on remount).
        setElapsed(Date.now() - timerStartRef.current);
        const timer = setInterval(() => {
          if (timerStartRef.current) {
            setElapsed(Date.now() - timerStartRef.current);
          }
        }, 100);
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
  }, [msg.role, isLast, isAILoading, completionTime, msg.logId, elapsed, msg.timestamp]);

  const markdownComponents = useMemo(() => {
    return {
      del: ({ node, children, ...props }: any) => {
        const text = String(children);
        if (text === 'AICURSORZX') {
          return <span className="ai-cursor-inline">█</span>;
        }
        return <del className="line-through decoration-white/30" {...props}>{children}</del>;
      },
      p: ({ node, children }: any) => {
        const inTable = useContext(InTableContext);
        const isStatus = typeof children === 'string' && (children.includes('Preparing tool') || children.includes('Thinking'));
        const isEmpty = !children || (Array.isArray(children) && children.length === 0) || (typeof children === 'string' && !children.trim());

        if (isStatus) {
          return (
            <div className="mb-0 font-sans font-medium opacity-30 text-[14px] tracking-[0] flex items-center">
              <StatusTyping text={children} />
            </div>
          );
        }


        const childrenArray = React.Children.toArray(children);
        const isPureText = childrenArray.every(c => typeof c === 'string');
        const contentStr = isPureText ? childrenArray.join('') : '';
        const hasPotentialImage = contentStr.includes('![');

        if (isPureText && hasPotentialImage) {
          // Robust regex for image markdown with optional title
          const imgMatch = contentStr.match(/!\[(.*?)\]\s*\(\s*([^)]+?)(?:\s+"([^"]+)")?\s*\)/);
          if (imgMatch) {
            const altText = imgMatch[1];
            const rawSrc = imgMatch[2].trim();
            const cleanSrc = rawSrc.replace(/\s/g, ''); // Data URLs shouldn't have spaces
            const descriptionFromMarkdown = imgMatch[3];
            const description = msg.image_description || descriptionFromMarkdown;
            const matchIndex = contentStr.indexOf(imgMatch[0]);
            const textBefore = contentStr.substring(0, matchIndex);
            const textAfter = contentStr.substring(matchIndex + imgMatch[0].length);

            return (
              <div className="mb-2 last:mb-0 break-words !max-w-full !w-full text-[var(--bone-100)]" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: compact ? '13.5px' : '17px', letterSpacing: '-0.01em' }}>
                {textBefore && <span style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: compact ? '13.5px' : '17px', letterSpacing: '-0.01em' }}>{renderContentWithStyles(textBefore)}</span>}
                <ChatImage
                  key={cleanSrc.substring(0, 32) + (description?.length || 0)}
                  src={cleanSrc}
                  alt="Generated Image"
                  description={description}
                  messageId={msg.id}
                  onHeightChange={scrollToBottom}
                  onAddToWorkspace={() => handleAddImageToWorkspace(cleanSrc)}
                />
                {textAfter && <span style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: compact ? '13.5px' : '17px', letterSpacing: '-0.01em' }}>{renderContentWithStyles(textAfter)}</span>}
              </div>
            );
          }
        }

        // Basic client-side mention replacement for rendering (purely visual)
        const entities = useStore.getState().entities;
        const spaces = useStore.getState().spaces;
        const renderedContent = parseMentions(childrenArray, entities, spaces);

        return (
          <div className="mb-2 last:mb-0 break-words !max-w-full !w-full text-[var(--bone-100)]" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: compact ? '13.5px' : '17px', letterSpacing: '-0.01em' }}>
            {renderedContent.map((c, i) => <React.Fragment key={i}>{typeof c === 'string' ? renderContentWithStyles(c) : c}</React.Fragment>)}
          </div>
        );
      },
      h1: ({ node, children }: any) => {
        return <h1 className="text-2xl font-medium mb-4 text-bone-100 mt-6 first:mt-0" style={{ fontFamily: 'var(--font-display)', fontSize: compact ? '20px' : '27px', letterSpacing: '-0.01em', fontWeight: 500 }}>{renderContentWithStyles(children)}</h1>;
      },
      h2({ node, children }: any) {
        return <h2 className="text-xl font-medium mb-3 text-bone-100 mt-5" style={{ fontFamily: 'var(--font-display)', fontSize: compact ? '17px' : '23px', letterSpacing: '-0.01em', fontWeight: 500 }}>{renderContentWithStyles(children)}</h2>;
      },
      h3({ node, children }: any) {
        return <h3 className="text-lg font-medium mb-2 text-bone-100 mt-4" style={{ fontFamily: 'var(--font-display)', fontSize: compact ? '15px' : '19px', letterSpacing: '-0.01em', fontWeight: 500 }}>{renderContentWithStyles(children)}</h3>;
      },

      a: ({ href, children }: any) => {
        const isCitation = typeof children === 'string' && /^\[\d+\]$/.test(children);

        const ensureAbsoluteUrl = (urlStr: string): string => {
          if (!urlStr) return '';
          if (
            urlStr.startsWith('http://') ||
            urlStr.startsWith('https://') ||
            urlStr.startsWith('mailto:') ||
            urlStr.startsWith('tel:') ||
            urlStr.startsWith('/') ||
            urlStr.startsWith('#')
          ) {
            return urlStr;
          }
          return `https://${urlStr}`;
        };

        const absoluteHref = ensureAbsoluteUrl(href);

        if (isCitation) {
          return (
            <a
              href={absoluteHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-3.5 h-3.5 -mt-2.5 ml-0.5 bg-white/10 hover:bg-white/20 rounded-full text-[8.5px] font-bold text-bone-100 no-underline align-super transition-all duration-200 select-none border border-white/5"
            >
              {children.replace(/[\[\]]/g, '')}
            </a>
          );
        }

        let isPill = false;
        let displayChildren = children;

        const checkAndStripPillPrefix = (node: any): { isPill: boolean; node: any } => {
          if (typeof node === 'string') {
            if (node.startsWith('pill:')) {
              return { isPill: true, node: node.slice(5) };
            }
            return { isPill: false, node };
          }
          if (Array.isArray(node)) {
            if (node.length > 0) {
              const firstResult = checkAndStripPillPrefix(node[0]);
              if (firstResult.isPill) {
                return { isPill: true, node: [firstResult.node, ...node.slice(1)] };
              }
            }
            return { isPill: false, node };
          }
          if (node && typeof node === 'object' && 'props' in node && node.props?.children) {
            const childResult = checkAndStripPillPrefix(node.props.children);
            if (childResult.isPill) {
              return {
                isPill: true,
                node: React.cloneElement(node, { ...node.props, children: childResult.node })
              };
            }
          }
          return { isPill: false, node };
        };

        const res = checkAndStripPillPrefix(children);
        isPill = res.isPill;
        displayChildren = res.node;

        const getHostname = (urlStr: string): string => {
          if (!urlStr) return '';
          try {
            const cleanUrl = urlStr.startsWith('http://') || urlStr.startsWith('https://')
              ? urlStr
              : `https://${urlStr}`;
            return new URL(cleanUrl).hostname.replace('www.', '');
          } catch {
            return '';
          }
        };

        const linkHost = getHostname(absoluteHref);
        const isSourceCitation = !!(msg.citations && msg.citations.some(citeUrl => {
          const citeHost = getHostname(citeUrl);
          return citeHost && linkHost && citeHost === linkHost;
        }));

        if (isPill || isSourceCitation) {
          return <LinkWithPopup href={absoluteHref}>{displayChildren}</LinkWithPopup>;
        }

        return (
          <a
            href={absoluteHref}
            target="_blank"
            rel="noopener noreferrer"
            className="chat-standard-link"
          >
            {displayChildren}
          </a>
        );
      },
      strong({ children }: any) {
        const inTable = !!useContext(InTableContext);
        return <strong className="font-medium" style={!inTable ? { fontFamily: 'var(--font-display)', fontWeight: 500, letterSpacing: '-0.01em' } : undefined}>{renderContentWithStyles(children)}</strong>;
      },
      em({ children }: any) {
        const inTable = !!useContext(InTableContext);
        return <em className="italic" style={!inTable ? { fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' } : undefined}>{renderContentWithStyles(children)}</em>;
      },
      ul: ({ children, className: ulClassName }: any) => {
        const isTaskList = typeof ulClassName === 'string' && ulClassName.includes('contains-task-list');
        return (
          <ListTypeContext.Provider value="ul">
            <ul className={cn("list-none space-y-[0.4rem] mb-4 last:mb-0", isTaskList ? "pl-0" : "pl-0")}>
              {children}
            </ul>
          </ListTypeContext.Provider>
        );
      },
      ol: ({ children }: any) => (
        <ListTypeContext.Provider value="ol">
          <ol className="[counter-reset:list-counter] list-none space-y-[0.4rem] mb-4 last:mb-0 pl-0">
            {children}
          </ol>
        </ListTypeContext.Provider>
      ),
      li: ({ children, checked, node, ...props }: any) => {
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

        const listType = useContext(ListTypeContext);

        return (
          <li className={cn(
            "flex items-start group/li gap-1.5",
            listType === 'ol' ? "[counter-increment:list-counter]" : "",
            "list-none"
          )}>
            <div className="shrink-0 w-5 flex justify-end items-start select-none" aria-hidden="true">
              {isChecklist ? (
                <span className="mt-[7px] flex items-center justify-center" onClick={handleToggle}>
                  <span className={cn(
                    "w-[16px] h-[16px] rounded-[4px] border flex items-center justify-center cursor-pointer",
                    "bg-[var(--app-dark)] border-[var(--bone-30)] hover:border-[var(--bone-70)]"
                  )}>
                    {isChecked && (
                      <Check className="w-[10px] h-[10px] text-[var(--bone-100)]" strokeWidth={3} />
                    )}
                  </span>
                </span>
              ) : listType === 'ul' ? (
                <span className="w-[5.5px] h-[5.5px] rounded-full bg-bone-70/40 mt-[11px] mr-1" />
              ) : listType === 'ol' ? (
                <span className={cn("text-bone-70/40 font-normal font-serif tracking-tight mt-0 before:content-[counter(list-counter)_'.']", compact ? "text-[13.5px]" : "text-[17px]")} style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }} />
              ) : null}
            </div>
            <div className="flex-1 min-w-0 leading-[1.6] font-normal tracking-[0] break-words !max-w-full !w-full text-[var(--bone-100)]" style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: compact ? '13.5px' : '17px', letterSpacing: '-0.01em' }}>
              <InListContext.Provider value={true}>
                {renderContentWithStyles(filteredChildren)}
              </InListContext.Provider>
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
        <blockquote className="border-l-4 border-white/10 pl-4 py-1 mt-3 mb-6 italic bg-white/5 rounded-r text-bone-70">
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

        // Intercept block-level code elements that are actually mono-pills
        let contentStr = String(children).replace(/\n$/, '');
        const hasCursor = contentStr.endsWith('~~AICURSORZX~~');
        if (hasCursor) {
          contentStr = contentStr.replace('~~AICURSORZX~~', '');
        }

        const isMonoPillBlock = !inline && contentStr.startsWith('[m]') && contentStr.endsWith('[/m]');

        if (isMonoPillBlock) {
          return (
            <span className="inline-block my-1">
              {renderContentWithStyles(contentStr)}
              {hasCursor && <span className="ai-cursor-inline ml-1">█</span>}
            </span>
          );
        }

        const inTable = !!useContext(InTableContext);

        if (inline || inTable) {
          return (
            <code className={cn("bg-[var(--app-dark)] rounded px-1.5 py-0.5 font-mono tracking-[0] font-medium", compact ? "text-[11px]" : "text-[12px]", inTable && "inline-flex px-1 py-0 leading-tight")} style={{ fontFamily: 'DM Mono' }} {...props}>
              {contentStr}{hasCursor && <span className="ai-cursor-inline">█</span>}
            </code>
          );
        }

        const matchLang = /language-(\w+)/.exec(className || '');
        const language = matchLang ? matchLang[1] : 'Code';
        const isMono = language !== 'markdown' && language !== 'text';
        const inList = useContext(InListContext);
        const isSingleRow = !contentStr.includes('\n');

        return (
          <div className={cn(
            "mt-3 mb-6 w-full rounded-3xl overflow-hidden border border-[var(--bone-6)] bg-panel group/code relative",
            inList && "ml-[-12px] !w-[calc(100%+12px)]"
          )}>
            <button
              onClick={() => navigator.clipboard.writeText(contentStr)}
              className={cn(
                "absolute right-3 px-2 py-1.5 rounded-md bg-white/[0.05] text-white/40 hover:bg-white/[0.1] hover:text-white border border-[var(--bone-6)] transition-all opacity-0 group-hover/code:opacity-100 select-none cursor-pointer z-20 flex items-center gap-1.5",
                isSingleRow ? "top-1/2 -translate-y-1/2" : "top-2.5"
              )}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>

            <pre className="px-4 py-3 overflow-x-auto m-0 bg-transparent">

              <code className={cn("leading-relaxed font-mono text-[var(--bone-100)]", compact ? "text-[12px]" : "text-[14px]", isMono ? "font-mono" : "font-sans")} style={isMono ? { fontFamily: 'DM Mono' } : undefined} {...props}>
                {contentStr}{hasCursor && <span className="ai-cursor-inline">█</span>}
              </code>
            </pre>
          </div>
        );

      },
      hr: () => <hr className="border-[var(--bone-12)] my-4" />,
      img: ({ src, alt }: any) => {
        if (!src) return null;
        const cleanSrc = src.trim().replace(/\n/g, '').replace(/\r/g, '');
        // Skip fabricated/invalid URLs entirely (bot occasionally emits bogus image markdown)
        if (!/^(data:image\/|https?:\/\/|\/)/.test(cleanSrc)) return null;
        return (
          <ChatImage
            src={cleanSrc}
            alt={alt || ''}
            description={msg.image_description}
            messageId={msg.id}
            onHeightChange={scrollToBottom}
            onAddToWorkspace={() => handleAddImageToWorkspace(cleanSrc)}
          />
        );
      },
      table: ({ children }: any) => {
        const inList = !!useContext(InListContext);
        return (
          <InTableContext.Provider value={true}>
            <div className={cn(
              "overflow-x-auto mt-3 mb-6 border border-[var(--bone-10)] rounded-2xl w-full bg-panel",
              inList && "ml-[-12px] !w-[calc(100%+12px)]"
            )}>
              <table className={cn("w-full border-collapse font-sans", compact ? "text-[11.5px]" : "text-[13px]")}>{children}</table>
            </div>
          </InTableContext.Provider>
        );
      },
      thead: ({ children }: any) => (
        <InHeaderContext.Provider value={true}>
          <thead className="bg-[var(--bone-5)] border-b border-b-[var(--bone-10)]">{children}</thead>
        </InHeaderContext.Provider>
      ),
      tbody: ({ children }: any) => <tbody>{children}</tbody>,
      tr: ({ children }: any) => <tr className="border-b border-b-[var(--bone-10)] last:border-b-0">{children}</tr>,
      th: ({ children }: any) => <th className={cn("px-3 py-2.5 text-left font-bold uppercase tracking-wider text-bone-100 font-sans border-r border-r-[var(--bone-10)] last:border-r-0", compact ? "text-[9.5px]" : "text-[10.5px]")}>{children}</th>,
      td: ({ children }: any) => (
        <td className="px-3 py-2.5 text-bone-100 font-sans leading-snug first:font-semibold first:text-bone-100 border-r border-r-[var(--bone-10)] last:border-r-0">
          {children}
        </td>
      ),
    };
  }, [scrollToBottom, handleAddImageToWorkspace, isAILoading, targetContent]);

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

  // Advisor card rendering
  const isAdvisorMessage = !!(msg as any).advisor_questions;
  const advisorState: any = (msg as any).advisor_state ? (() => { try { return JSON.parse((msg as any).advisor_state); } catch { return null; } })() : null;

  const isError = msg.role === 'assistant' && (msg.content || '').startsWith('Error:');
  const isInterrupted = msg.role === 'assistant' && !!msg.interrupted;

  if (msg.role === 'assistant' && !displayContent && !(isAILoading && isLast) && !isInterrupted) return null;

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

  if (isInterrupted) {
    return (
      <div className="flex flex-col group items-start mb-3">
        <div className="flex gap-3 w-full items-start flex-row">
          <div className="flex flex-col min-w-0 items-start max-w-full flex-1">
            <div className="prose prose-invert max-w-none w-full opacity-60 italic" style={{ fontFamily: 'var(--font-display)', fontSize: compact ? '13.5px' : '17px', fontWeight: 400, letterSpacing: '-0.01em', color: 'var(--bone-100)' }}>
              <span>Interrupted</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col group",
      msg.role === 'user' ? "items-end mb-8" : "items-start mb-3"
    )}>
      <div className={cn(
        "flex gap-3 w-full items-start",
        msg.role === 'user' ? "flex-row" : "flex-row"
      )}>
        <div className={cn(
          "flex flex-col min-w-0",
          msg.role === 'user' ? "items-end max-w-[90%] ml-auto" : "items-start max-w-full flex-1"
        )}>
          {msg.role === 'assistant' && isLast && !displayContent ? (
            <div className="flex items-center gap-2.5 h-5 select-none -ml-1 mb-1">
              <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                <AIAvatar isTyping={true} className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-2">
                <StatusTyping
                  text={(() => {
                    if (msg.status) return msg.status;
                    if (msg.pipelineSteps && msg.pipelineSteps.length > 0) {
                      const activeStep = msg.pipelineSteps.find(s => s.status === 'running') || msg.pipelineSteps[msg.pipelineSteps.length - 1];
                      if (activeStep) {
                        if (activeStep.label) return activeStep.label;
                        if (activeStep.chain) {
                          const custom = DEFAULT_STATUS_MESSAGES[activeStep.chain];
                          if (custom) return custom;
                        }
                        return activeStep.goal || activeStep.chain || "Working...";
                      }
                    }
                    const category = thinkingEnabled ? "THINKING" : "CLASSIFIER";
                    return DEFAULT_STATUS_MESSAGES[category] || "Working...";
                  })()}
                  className="font-normal text-[var(--bone-100)]"
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: compact ? '16px' : '16px', letterSpacing: '-0.01em' }}
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
              {!displayContent && msg.role === 'assistant' ? null : (
                msg.role === 'user' ? (
                  <div className="w-full flex flex-col items-end">
                    <UserMessageBubble
                      msg={msg}
                      targetContent={targetContent}
                      compact={compact}
                      openModal={openModal}
                    />
                    <div
                      className={cn(
                        "flex items-center gap-3 justify-end mt-3 transition-opacity duration-150 transform-gpu",
                        isLast ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
                      )}
                    >
                      {msg.timestamp && (
                        <Tooltip content={new Date(msg.timestamp).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}>
                          <span className="px-1 text-[11px] text-[var(--bone-30)] select-none cursor-default">
                            {new Date(msg.timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </Tooltip>
                      )}
                      <div className="flex items-center gap-1">
                        <Tooltip content="Reply">
                          <button
                            onClick={() => onReply(msg)}
                            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--app-dark)] text-foreground opacity-30 hover:opacity-100 transition-none"
                          >
                            <CornerUpLeft strokeWidth={2} className="w-4 h-4" />
                          </button>
                        </Tooltip>
                        <Tooltip content="Copy">
                          <button
                            onClick={() => navigator.clipboard.writeText(targetContent)}
                            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--app-dark)] text-foreground opacity-30 hover:opacity-100 transition-none"
                          >
                            <Copy strokeWidth={2} className="w-4 h-4" />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full">
                    {hasThinking && (
                      <div className="mb-3">
                        <button
                          onClick={() => setShowThinking(!showThinking)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-[12px] transition-all border border-white/5",
                            showThinking
                              ? "bg-white/10 text-bone-100 border-white/10"
                              : "bg-[var(--bone-5)] hover:bg-[var(--bone-10)] text-[var(--bone-70)] hover:text-[var(--bone-90)]"
                          )}
                        >
                          <Brain className={cn("w-3.5 h-3.5", isAILoading && isLast ? "text-bone-100 animate-pulse" : "text-bone-70")} />
                          <span className="font-semibold tracking-tight">{isAILoading && isLast ? 'Thinking...' : 'Reasoning'}</span>
                          <ChevronDown className={cn("w-3.5 h-3.5 opacity-50 transition-transform duration-300", showThinking && "rotate-180")} />
                        </button>
                        {showThinking && (
                          <div className="mt-2 pl-4 ml-2 border-l border-white/10 pr-4 py-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="text-[14px] text-[var(--bone-70)] leading-relaxed prose prose-invert !max-w-none prose-p:my-1 prose-sm opacity-90 font-sans">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {thinkContent}
                              </ReactMarkdown>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className={cn(
                      "transition-all duration-500 min-h-[20px] flex flex-col",
                      isAILoading && isLast && !displayContent && "opacity-0"
                    )}>
                      {isAdvisorMessage ? (
                        <AdvisorCard content={displayContent} state={advisorState} compact={compact} />
                      ) : isPureImage ? (
                        <div className="group/row relative transition-colors">
                          {(() => {
                            const imgMatch = displayContent.match(/!\[(.*?)\]\s*\(\s*([^)]+?)(?:\s+"([^"]+)")?\s*\)/) ||
                              displayContent.match(/!\[(.*?)\]\s*\(\s*(data:image\/.*?;base64,[\s\S]*?|https?:\/\/[\s\S]*?|AUO[\s\S]*?)(?:\s*\)|$)/);
                            if (imgMatch) {
                              const cleanSrc = imgMatch[2].trim().replace(/\s/g, '');
                              const descriptionFromMarkdown = imgMatch[3];
                              const description = msg.image_description || descriptionFromMarkdown;
                              return (
                                <ChatImage
                                  key={cleanSrc.substring(0, 32) + (description?.length || 0)}
                                  src={cleanSrc}
                                  alt={imgMatch[1] || 'Generated Image'}
                                  description={description}
                                  messageId={msg.id}
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
                        <div className={cn(
                          "prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/30 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-[14px]",
                          "prose-headings:font-bold prose-headings:text-bone-100 prose-p:text-bone-80 prose-strong:text-bone-100",
                          "prose-a:text-[var(--bone-100)] prose-a:underline prose-a:decoration-[var(--bone-30)] prose-a:underline-offset-[3px] hover:prose-a:decoration-[var(--bone-100)] transition-colors",
                          "prose-code:text-emerald-300 prose-code:bg-emerald-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none",
                          "prose-blockquote:border-l-emerald-500/50 prose-blockquote:bg-emerald-500/5 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg",
                          "w-full overflow-hidden relative [&_p]:my-0 break-words",
                          isAILoading && msg.role === 'assistant' && "prose-streaming"
                        )} style={{ fontFamily: 'var(--font-display)', fontSize: compact ? '15.5px' : '18px', fontWeight: 400, letterSpacing: '-0.01em', color: 'var(--bone-100)' }}>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={markdownComponents as any}
                          >
                            {renderedDisplayContent}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>

                    {msg.toolResults && msg.toolResults.length > 0 && (
                      <div className="flex flex-col gap-2 w-full mt-3">
                        {msg.toolResults.filter(tr => {
                          const name = String((tr as any).tool || tr.type || '')
                          if (!(tr as any).success) return false
                          if ((tr as any).status === 'pending_confirmation') return false
                          return ['create_content', 'update_content', 'append_to_note', 'move_content', 'manage_brain'].includes(name)
                        }).map((tr, i) => {
                          const actionName = String((tr as any).tool || tr.type || '')
                          const isTask = tr.type === 'task' || (tr.id && tr.id.startsWith('task-'))
                          const isCanvas = tr.type === 'canvas' || (tr.id && tr.id.startsWith('canvas-'))
                          const isFolder = tr.type === 'folder' || tr.type === 'workspace' || (tr.id && (tr.id.startsWith('folder-') || tr.id.startsWith('workspace-')))

                          let actionText: string
                          if (actionName === 'create_content') {
                            const type = (tr.type && tr.type !== actionName) ? tr.type : (isTask ? 'Task' : isCanvas ? 'Canvas' : isFolder ? 'Folder' : 'Note')
                            actionText = `New ${String(type).charAt(0).toUpperCase() + String(type).slice(1)}`
                          } else if (actionName === 'update_content' || actionName === 'append_to_note') {
                            actionText = 'Edited'
                          } else if (actionName === 'move_content') {
                            actionText = 'Moved'
                          } else if (actionName === 'manage_brain') {
                            const trMem = tr as any;
                            actionText = trMem.op === 'add_node' ? 'NEW BRAIN NODE' : trMem.op === 'update_node' ? 'UPDATED BRAIN NODE' : trMem.op === 'remove_node' ? 'REMOVED BRAIN NODE' : 'BRAIN'
                          } else {
                            actionText = 'Action'
                          }

                          const matchedEntity = !isTask ? useStore.getState().entities.find(e => e.id === tr.id) : null
                          const matchedTask = isTask ? useStore.getState().tasks.find(t => t.id === tr.id) : null
                          const entityTitle = actionName === 'manage_brain' ? ((tr as any).label || (tr as any).type || 'Brain') : (matchedEntity?.title || matchedTask?.title || tr.title || (tr.id ? `Entity ${tr.id.split('-')[0]}` : 'Untitled'))

                          return (
                            <div
                              key={i}
                              onClick={() => {
                                if (actionName === 'manage_brain') {
                                  useStore.getState().setActiveEntityId('brain');
                                  return;
                                }
                                if (!tr.id) return;
                                if (isTask) {
                                  useStore.getState().openTaskPanel(tr.id);
                                } else {
                                  setActiveEntityId(tr.id);
                                }
                              }}
                              className={cn(
                                "flex items-center gap-3 w-full px-4 py-3 rounded-[14px] transition-all duration-200 cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 group/card"
                              )}
                            >
                              <div className={cn("flex items-center text-bone-80 opacity-30 shrink-0 transition-all group-hover/card:opacity-80")}>
                                {actionName === 'manage_brain' ? (
                                  <Brain strokeWidth={1.5} className="w-8 h-8" />
                                ) : isTask ? (
                                  <CheckCircle2 strokeWidth={1.5} className="w-8 h-8" />
                                ) : isCanvas ? (
                                  <Layout strokeWidth={1.5} className="w-8 h-8" />
                                ) : isFolder ? (
                                  <Folder strokeWidth={1.5} className="w-8 h-8" />
                                ) : (
                                  <FileText strokeWidth={1.5} className="w-8 h-8" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <p className="text-[10px] uppercase tracking-wider text-bone-100 opacity-40 font-semibold mb-0.5">{actionText}</p>
                                <p className={cn("text-base font-serif font-medium tracking-tight text-bone-100 opacity-80 transition-opacity truncate", actionName !== 'manage_brain' && "group-hover/card:opacity-100")}>{entityTitle}</p>
                                {tr.content_preview && (
                                  <p className="text-xs text-bone-40 truncate mt-0.5">{tr.content_preview}</p>
                                )}
                              </div>
                              {actionName !== 'manage_brain' && (
                                <ChevronRight strokeWidth={2} className="w-4 h-4 text-bone-30 shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {(!isAILoading || msg.model) && (
                      <div
                        className={cn(
                          "flex flex-col gap-3 mt-4 transition-opacity duration-150 transform-gpu",
                          isLast ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
                        )}
                      >
                        {msg.citations && msg.citations.length > 0 && !displayContent.includes('[pill:') && (
                          <div className="mt-2 flex flex-wrap gap-2 pt-3 border-t border-white/5 w-full">

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
                                  className="flex items-center gap-2 px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-medium text-[var(--bone-70)] hover:text-bone-100 transition-none max-w-[160px] shrink-0"
                                >

                                  {faviconUrl && (
                                    <span className="w-3 h-3 flex items-center justify-center shrink-0 overflow-hidden">
                                      <img src={faviconUrl} alt="" className="w-3 h-3 object-contain opacity-60" />
                                    </span>
                                  )}
                                  <span className="flex-1 min-w-0 truncate">{domain || 'Source'}</span>
                                </a>
                              );
                            })}
                          </div>
                        )}

                        <div className="flex items-center gap-1">
                          {!isAILoading && (
                            <>
                              <Tooltip content="Copy Text">
                                <button
                                  onClick={() => navigator.clipboard.writeText(displayContent)}
                                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--app-dark)] text-foreground opacity-30 hover:opacity-100 transition-none"
                                >
                                  <Copy strokeWidth={2} className="w-4 h-4" />
                                </button>
                              </Tooltip>
                              <Tooltip content="Good response">
                                <button
                                  onClick={() => submitFeedback('like')}
                                  className={cn("w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--app-dark)] transition-none", feedbackState === 'like' ? "text-green-400 opacity-100" : "text-foreground opacity-30 hover:opacity-100")}
                                >
                                  <ThumbsUp strokeWidth={2} className="w-4 h-4" />
                                </button>
                              </Tooltip>
                              <Tooltip content="Bad response">
                                <button
                                  onClick={() => submitFeedback('dislike')}
                                  className={cn("w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--app-dark)] transition-none", feedbackState === 'dislike' ? "text-red-400 opacity-100" : "text-foreground opacity-30 hover:opacity-100")}
                                >
                                  <ThumbsDown strokeWidth={2} className="w-4 h-4" />
                                </button>
                              </Tooltip>
                              {onRegenerate && (
                                <Tooltip content="Regenerate">
                                  <button
                                    onClick={onRegenerate}
                                    className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--app-dark)] text-foreground opacity-30 hover:opacity-100 transition-none"
                                  >
                                    <RotateCcw strokeWidth={2} className="w-4 h-4" />
                                  </button>
                                </Tooltip>
                              )}
                              {totalVariants > 1 && msg.id && (
                                <div className="flex items-center gap-0.5 h-6 px-1 rounded-md border border-white/5 bg-white/[0.02]">
                                  <button
                                    onClick={() => setVariantIndex(msg.id!, currentVariantIndex - 1)}
                                    disabled={currentVariantIndex === 0}
                                    className="w-4 h-4 flex items-center justify-center text-foreground opacity-30 hover:opacity-100 disabled:opacity-10 disabled:cursor-not-allowed transition-none"
                                  >
                                    <ChevronLeft strokeWidth={2} className="w-3 h-3" />
                                  </button>
                                  <span className="text-[10px] font-medium text-[var(--bone-40)] tabular-nums px-0.5">
                                    {currentVariantIndex + 1}/{totalVariants}
                                  </span>
                                  <button
                                    onClick={() => setVariantIndex(msg.id!, currentVariantIndex + 1)}
                                    disabled={currentVariantIndex === totalVariants - 1}
                                    className="w-4 h-4 flex items-center justify-center text-foreground opacity-30 hover:opacity-100 disabled:opacity-10 disabled:cursor-not-allowed transition-none"
                                  >
                                    <ChevronRight strokeWidth={2} className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                              <Tooltip content="Reply">
                                <button
                                  onClick={() => onReply(msg)}
                                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--app-dark)] text-foreground opacity-30 hover:opacity-100 transition-none"
                                >
                                  <CornerUpLeft strokeWidth={2} className="w-4 h-4" />
                                </button>
                              </Tooltip>

                              {/* Copy to Note Button */}
                              {isChatNewNoteButtonVisible && (
                                <div className="flex items-center gap-0 relative h-7 rounded-md overflow-hidden bg-[var(--bone-6)] hover:bg-[var(--bone-12)] opacity-60 hover:opacity-100 transition-colors">
                                  {chatPageMode || !isNoteActive ? (
                                    <Tooltip content="Create a new note with this message">
                                      <button
                                        onClick={() => handleCopyToNote(true)}
                                        className="h-full px-2 flex items-center gap-1.5 text-[12px] font-semibold tracking-wider text-[var(--bone-40)] hover:text-bone-100 transition-colors"
                                      >
                                        <FileText className="w-3 h-3" />
                                        <span>New note</span>
                                      </button>
                                    </Tooltip>
                                  ) : (
                                    <Tooltip content="Append to active note">
                                      <button
                                        onClick={() => handleCopyToNote(false)}
                                        className="h-full px-2 flex items-center gap-1.5 text-[12px] font-semibold tracking-wider text-[var(--bone-40)] hover:text-bone-100 transition-colors"
                                      >
                                        <FileText className="w-3 h-3" />
                                        <span>Add to note</span>
                                      </button>
                                    </Tooltip>
                                  )}
                                </div>
                              )}
                              {/* Copy Transcript - only in dev server */}
                              {process.env.NODE_ENV === 'development' && chatPageMode && (
                                (msg as any).transcript_md ? (
                                  <>
                                    <div className="h-3 w-[1px] bg-white/5 mx-0.5" />
                                    <div className="flex items-center gap-0 relative h-6 border border-white/5 rounded-md overflow-hidden bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
                                      <Tooltip content="Copy full transcript (request, all chain inputs/outputs, reasoning, traces)">
                                        <button
                                          onClick={() => navigator.clipboard.writeText((msg as any).transcript_md)}
                                          className="h-full px-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--bone-40)] hover:text-bone-100 transition-colors"
                                        >
                                          <ClipboardCopy strokeWidth={2} className="w-2.5 h-2.5" />
                                          <span>Transcript</span>
                                        </button>
                                      </Tooltip>
                                    </div>
                                  </>
                                ) : !isAILoading && (
                                  <Tooltip content="Transcript not available (requires new AI request)">
                                    <div className="flex items-center gap-0 relative h-6 border border-white/5 rounded-md overflow-hidden opacity-30 cursor-not-allowed">
                                      <button disabled className="h-full px-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--bone-40)]">
                                        <ClipboardCopy strokeWidth={2} className="w-2.5 h-2.5" />
                                        <span>Transcript</span>
                                      </button>
                                    </div>
                                  </Tooltip>
                                )
                              )}
                            </>
                          )}

                          {msg.model && chatPageMode && (
                            <div className={cn(
                              "flex items-center px-2 py-0.5 rounded-full bg-[var(--app-dark)] opacity-40 hover:opacity-100 transition-all duration-300",
                              !isAILoading ? "ml-1" : "ml-0"
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
