import React, { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useStore } from '@/data/store';
import { FileText, Folder, CheckSquare, Settings, Layout, Hash } from 'lucide-react';

interface ChatInputEditableProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onCursorTextChange?: (textUpToCursor: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  isNewPage?: boolean;
}

export const ChatInputEditable = React.forwardRef<HTMLDivElement, ChatInputEditableProps>(
  ({ value, onChange, onKeyDown, onCursorTextChange, placeholder, className, disabled, isNewPage }, ref) => {
    const internalRef = useRef<HTMLDivElement>(null);
    const setRef = useCallback(
      (node: HTMLDivElement) => {
        internalRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [ref]
    );

    const [isFocused, setIsFocused] = useState(false);
    const entities = useStore(state => state.entities);
    const spaces = useStore(state => state.spaces);

    // Track internal text to avoid recursive updates
    const lastRenderedText = useRef(value);

    // Sync from prop (value) to contentEditable ONLY if it differs significantly
    useEffect(() => {
      if (!internalRef.current) return;
      if (value === '') {
        internalRef.current.innerHTML = '';
        lastRenderedText.current = '';
        return;
      }
      
      // We need a robust way to sync value to DOM without destroying cursor
      // Simple string comparison (ignoring HTML)
      const currentText = internalRef.current.innerText || '';
      if (currentText !== value && value !== lastRenderedText.current) {
        // Find entities in value and render them as HTML
        internalRef.current.innerHTML = renderPillsToHTML(value);
        lastRenderedText.current = value;
      }
    }, [value, entities, spaces]);

    // SVG path data for named workspace icons (matches ICON_MAP keys)
    const ICON_SVG_PATHS: Record<string, string> = {
      Terminal: 'M4 17l6-6-6-6M12 19h8',
      Code: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
      Folder: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z',
      Briefcase: 'M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16M2 9h20',
      Home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
      User: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
      Users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
      Star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
      Rocket: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2zM9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5',
      Globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
      Brain: 'M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z',
      Zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
      BookOpen: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
      GraduationCap: 'M22 10v6M2 10l10-5 10 5-10 5z M6 12v5c3 3 9 3 12 0v-5',
      Building2: 'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18zM6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 0-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4',
    };

    const getEntityIcon = (type: string, iconName?: string) => {
      if (iconName) {
        if (iconName.length <= 2) {
          return `<span class="font-emoji text-[12px] leading-none text-center opacity-80">${iconName}</span>`;
        }
        if (ICON_SVG_PATHS[iconName]) {
          return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-60"><path d="${ICON_SVG_PATHS[iconName]}"/></svg>`;
        }
      }
      
      if (type === 'workspace') return '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-box opacity-60"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>';
      switch (type) {
        case 'note': return '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-text opacity-60"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>';
        case 'folder': return '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-folder opacity-60"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>';
        case 'canvas': return '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-frame opacity-60"><line x1="22" x2="2" y1="6" y2="6"/><line x1="22" x2="2" y1="18" y2="18"/><line x1="6" x2="6" y1="2" y2="22"/><line x1="18" x2="18" y1="2" y2="22"/></svg>';
        default: return '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-hash opacity-60"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>';
      }
    };

    const renderPillsToHTML = (text: string) => {
      let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      
      // 1. Mentions
      const allMentionables = [
        ...entities
          .filter(e => ['folder', 'note', 'canvas'].includes(e.type))
          .map(e => ({ title: e.title, type: e.type, id: e.id, icon: e.icon })),
        ...spaces
          .map(w => ({ title: w.name || 'Space', type: 'workspace', id: w.id, icon: w.icon || (w.type === 'personal' || w.name === 'Personal' ? 'User' : 'Box') }))
      ];
      allMentionables.sort((a, b) => b.title.length - a.title.length);

      for (const item of allMentionables) {
        if (!item.title) continue;
        const mentionText = `@${item.title}`;
        const regex = new RegExp(`(?<=\\s|^)(${mentionText.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\$&')})(?=[\\s\\.,:;?!]|$)`, 'g');
        
        html = html.replace(regex, (match) => {
          return `<span data-raw-value="${match}" class="inline-flex items-center gap-1.5 px-1.5 py-[1px] mx-[1px] rounded-[8px] bg-[var(--bone-6)] hover:bg-[var(--bone-10)] text-[var(--bone-100)] font-medium tracking-tight text-[13px] align-middle select-all transition-colors cursor-pointer" style="font-family: inherit" contenteditable="false">${getEntityIcon(item.type, item.icon)}<span>${item.title}</span></span>&nbsp;`;
        });
      }

      // 2. Commands
      const COMMANDS = [
        { id: 'image', label: 'Generate Image', prefix: '/image', type: 'image' },
        { id: 'search', label: 'Web Search', prefix: '/search', type: 'search' },
        { id: 'research', label: 'Deep Research', prefix: '/research', type: 'research' },
        { id: 'note', label: 'New Note', prefix: '/note', type: 'note' },
        { id: 'canvas', label: 'New Canvas', prefix: '/canvas', type: 'canvas' },
        { id: 'task', label: 'New Task', prefix: '/task', type: 'task' },
      ];

      for (const cmd of COMMANDS) {
        const regex = new RegExp(`(?<=\\s|^)(${cmd.prefix})(?=\\s|$)`, 'g');
        html = html.replace(regex, (match) => {
          let iconSvg = '';
          if (cmd.id === 'image') iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-60"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
          else if (cmd.id === 'search') iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-60"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>';
          else if (cmd.id === 'research') iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-60"><path d="m10 10.5 2-2 5.5 5.5-2 2-5.5-5.5Z"/><path d="m13.41 12 1.59-1.59a2 2 0 0 1 2.83 0l.17.17a2 2 0 0 1 0 2.83l-1.59 1.59"/><path d="m12 13.41-1.59 1.59a2 2 0 0 1-2.83 0l-.17-.17a2 2 0 0 1 0-2.83l1.59-1.59"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/></svg>';
          else if (cmd.id === 'note') iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-60"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>';
          else if (cmd.id === 'canvas') iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-60"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="9" x2="9" y1="21" y2="9"/></svg>';
          else if (cmd.id === 'task') iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-60"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="m9 12 2 2 4-4"/></svg>';

          return `<span data-raw-value="${match}" class="inline-flex items-center gap-1.5 px-1.5 py-[1px] mx-[1px] rounded-[8px] bg-[var(--bone-6)] hover:bg-[var(--bone-10)] text-[var(--bone-100)] font-medium tracking-tight text-[13px] align-middle select-all transition-colors cursor-pointer" style="font-family: inherit" contenteditable="false">${iconSvg}<span>${cmd.label}</span></span>&nbsp;`;
        });
      }

      return html.replace(/\\n/g, '<br>');
    };

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
      if (disabled) return;
      const el = e.currentTarget;
      
      let text = '';
      const walk = (node: Node, isFirstElement: boolean = false) => {
        if (node.nodeType === Node.TEXT_NODE) {
          text += (node.textContent || '').replace(/\\u00A0/g, ' ');
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          if (element.hasAttribute('data-raw-value')) {
            text += element.getAttribute('data-raw-value');
          } else if (element.tagName === 'BR') {
            text += '\\n';
          } else if (element.tagName === 'DIV' || element.tagName === 'P') {
            if (!isFirstElement && text.length > 0) text += '\\n';
            element.childNodes.forEach(n => walk(n));
          } else {
            element.childNodes.forEach(n => walk(n));
          }
        }
      };
      
      Array.from(el.childNodes).forEach((n, i) => walk(n, i === 0));
      
      // If the browser left only whitespace/newlines or zero-width chars when all text is deleted, treat it as empty
      const rawText = el.textContent || '';
      const cleanText = rawText.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      if (cleanText === '' && !el.querySelector('[data-raw-value]')) {
        text = '';
        // Also clear the actual DOM to prevent browser accumulation of invisible nodes
        if (el.innerHTML !== '') {
          el.innerHTML = '';
        }
      } else if (text.endsWith('\n\n')) {
        text = text.slice(0, -1);
      }
      
      lastRenderedText.current = text;
      onChange(text);

      if (onCursorTextChange) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          try {
            const range = sel.getRangeAt(0).cloneRange();
            range.setStart(el, 0);
            
            // To get text up to cursor, we walk the nodes up to the end container
            let textUpToCursor = '';
            let foundEnd = false;
            
            const walkUntilCursor = (node: Node) => {
              if (foundEnd) return;
              if (node === range.endContainer) {
                foundEnd = true;
                if (node.nodeType === Node.TEXT_NODE) {
                  textUpToCursor += (node.textContent || '').substring(0, range.endOffset).replace(/\\u00A0/g, ' ');
                }
                return;
              }
              if (node.nodeType === Node.TEXT_NODE) {
                textUpToCursor += (node.textContent || '').replace(/\\u00A0/g, ' ');
              } else if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as HTMLElement;
                if (element.hasAttribute('data-raw-value')) {
                  textUpToCursor += element.getAttribute('data-raw-value');
                } else if (element.tagName === 'BR') {
                  textUpToCursor += '\\n';
                } else {
                  element.childNodes.forEach(walkUntilCursor);
                }
              }
            };
            
            Array.from(el.childNodes).forEach(walkUntilCursor);
            onCursorTextChange(textUpToCursor);
          } catch (e) {
            onCursorTextChange(text);
          }
        } else {
          onCursorTextChange(text);
        }
      }
      
      // Auto-resize logic
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Prevent inserting extra divs on Enter
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onKeyDown(e);
        return;
      }
      onKeyDown(e);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    };

    // Placeholder hack
    const showPlaceholder = value.length === 0;
    const fontSize = isNewPage ? '17.5px' : '17px';

    return (
      <div className="relative w-full" style={{ fontSize }}>
        {showPlaceholder && placeholder && (
          <div className="absolute top-0 left-0 text-bone-70 pointer-events-none px-1" style={{ fontSize: 'inherit', lineHeight: 'relaxed' }}>
            {placeholder}
          </div>
        )}
        <div
          ref={setRef}
          contentEditable={!disabled}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={cn(
            "w-full bg-transparent text-foreground focus:outline-none resize-none leading-relaxed px-1 custom-scrollbar tracking-wide text-left",
            className
          )}
          style={{ 
            fontSize,
            height: 'auto', 
            maxHeight: '120px', 
            overflowY: 'auto', 
            minHeight: '24px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}
        />
      </div>
    );
  }
);

ChatInputEditable.displayName = 'ChatInputEditable';
