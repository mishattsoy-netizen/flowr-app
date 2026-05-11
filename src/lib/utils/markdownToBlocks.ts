import { EditorBlock, generateId } from '@/data/store';

export function inlineMarkdownToHtml(text: string): string {
  if (!text) return '';
  // Escape basic HTML to prevent injection from source content
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/~~(.*?)~~/g, '<s>$1</s>')
    .replace(/`(.*?)`/g, '<code class="font-mono bg-white/10 px-1 rounded text-[0.9em]">$1</code>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-accent hover:underline" target="_blank">$1</a>');
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

