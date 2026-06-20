import { EditorBlock, generateId } from '@/data/store';

export function inlineMarkdownToHtml(text: string): string {
  if (!text) return '';
  // Escape basic HTML to prevent injection from source content
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // links
  let s = escaped
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/~~(.*?)~~/g, '<s>$1</s>')
    .replace(/`(.*?)`/g, '<code class="font-mono bg-white/10 px-1 rounded text-[0.9em]">$1</code>')
    .replace(/\[(.*?)\]\((.*?)\)/g, (match, label, url) => {
      const isPill = label.startsWith('pill:');
      const displayLabel = isPill ? label.slice(5) : label;
      if (isPill) {
        let faviconUrl = '';
        try {
          if (url.startsWith('http')) {
            faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;
          }
        } catch (e) {}

        const faviconHtml = faviconUrl 
          ? `<span class="w-3.5 h-3.5 flex items-center justify-center shrink-0 overflow-hidden rounded-[4px] pointer-events-none"><img src="${faviconUrl}" class="w-3 h-3 object-contain select-none opacity-80" alt="" /></span>`
          : `<span class="w-3.5 h-3.5 flex items-center justify-center shrink-0 overflow-hidden pointer-events-none"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link w-3 h-3 text-[var(--bone-100)] opacity-60 shrink-0 pointer-events-none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg></span>`;

        return `<a href="${url}" class="inline-link-btn px-2 py-0.5 mx-1 inline-flex items-center gap-1.5 bg-[var(--bone-5)] hover:bg-[var(--bone-10)] rounded-full text-[11px] font-bold font-sans text-[var(--bone-70)] hover:text-[var(--bone-100)] no-underline select-none border border-[var(--bone-10)] align-baseline" contenteditable="false" data-url="${url}" data-label="${displayLabel}">${faviconHtml}<span class="max-w-[120px] truncate font-medium pointer-events-none">${displayLabel}</span></a>`;
      } else {
        return `<a href="${url}" class="text-accent hover:underline" target="_blank">${displayLabel}</a>`;
      }
    });

  // plain URLs
  s = s.replace(/(?<!href=")(?<!">)\b(https?:\/\/[^\s<>'")]+?)(?=[.,?!]?(?:\s|$))/gi, '<a href="$1" class="text-accent hover:underline" target="_blank">$1</a>');

  return s;
}

export function parseMarkdownToBlocks(markdown: string): EditorBlock[] {
  if (!markdown) return [{ id: generateId(), type: 'text', style: 'body', content: '' }];
  const blocks: EditorBlock[] = [];
  const lines = markdown.split('\n');
  
  let currentTable: string[][] | null = null;
  let inCodeBlock = false;
  let codeContent = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (inCodeBlock) {
      if (line.trim().startsWith('```')) {
        inCodeBlock = false;
        blocks.push({ id: generateId(), type: 'text', style: 'mono', content: codeContent.trim() });
        codeContent = '';
      } else {
        codeContent += line + '\n';
      }
      continue;
    }

    if (line.trim().startsWith('```')) {
      inCodeBlock = true;
      continue;
    }

    if (line.trim() === '---') {
      blocks.push({ id: generateId(), type: 'divider', content: "" });
      continue;
    }

    if (line.trim().startsWith('|')) {
      const row = line.split('|').map(c => inlineMarkdownToHtml(c.trim())).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (row.length > 0) {
        if (line.includes('---')) continue; // Skip separator row
        if (!currentTable) currentTable = [];
        currentTable.push(row);
      }
      continue;
    } else if (currentTable) {
      blocks.push({ id: generateId(), type: 'table', tableData: currentTable, content: "" });
      currentTable = null;
    }

    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('### ')) {
      blocks.push({ id: generateId(), type: 'text', style: 'subheading', content: inlineMarkdownToHtml(trimmed.slice(4)) });
    } else if (trimmed.startsWith('## ')) {
      blocks.push({ id: generateId(), type: 'text', style: 'heading', content: inlineMarkdownToHtml(trimmed.slice(3)) });
    } else if (trimmed.startsWith('# ')) {
      blocks.push({ id: generateId(), type: 'text', style: 'title', content: inlineMarkdownToHtml(trimmed.slice(2)) });
    } else if (/^[-*+]?\s*\[([ xX])\]\s+/.test(trimmed)) {
      const checked = /^[-*+]?\s*\[x\]/i.test(trimmed);
      const content = trimmed.replace(/^[-*+]?\s*\[[ xX]\]\s+/, '');
      blocks.push({ id: generateId(), type: 'checklist', content: inlineMarkdownToHtml(content), checked });
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blocks.push({ id: generateId(), type: 'bulletList', content: inlineMarkdownToHtml(trimmed.slice(2)) });
    } else if (/^\d+\.\s/.test(trimmed)) {
      blocks.push({ id: generateId(), type: 'numberedList', content: inlineMarkdownToHtml(trimmed.replace(/^\d+\.\s/, '')) });
    } else if (trimmed.startsWith('> ')) {
      blocks.push({ id: generateId(), type: 'quote', content: inlineMarkdownToHtml(trimmed.slice(2)) });
    } else {
      blocks.push({ id: generateId(), type: 'text', style: 'body', content: inlineMarkdownToHtml(trimmed) });
    }
  }

  if (currentTable) {
    blocks.push({ id: generateId(), type: 'table', tableData: currentTable, content: "" });
  }

  return blocks.length > 0 ? blocks : [{ id: generateId(), type: 'text', style: 'body', content: '' }];
}

