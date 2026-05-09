import { EditorBlock, generateId } from '@/data/store';

export function parseMarkdownToBlocks(markdown: string): EditorBlock[] {
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
      blocks.push({ id: generateId(), type: 'divider' });
      continue;
    }

    if (line.trim().startsWith('|')) {
      const row = line.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (row.length > 0) {
        if (line.includes('---')) continue; // Skip separator row
        if (!currentTable) currentTable = [];
        currentTable.push(row);
      }
      continue;
    } else if (currentTable) {
      blocks.push({ id: generateId(), type: 'table', tableData: currentTable });
      currentTable = null;
    }

    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('### ')) {
      blocks.push({ id: generateId(), type: 'text', style: 'subheading', content: trimmed.slice(4) });
    } else if (trimmed.startsWith('## ')) {
      blocks.push({ id: generateId(), type: 'text', style: 'heading', content: trimmed.slice(3) });
    } else if (trimmed.startsWith('# ')) {
      blocks.push({ id: generateId(), type: 'text', style: 'title', content: trimmed.slice(2) });
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blocks.push({ id: generateId(), type: 'bulletList', content: trimmed.slice(2) });
    } else if (/^\d+\.\s/.test(trimmed)) {
      blocks.push({ id: generateId(), type: 'numberedList', content: trimmed.replace(/^\d+\.\s/, '') });
    } else if (trimmed.startsWith('[ ] ') || trimmed.startsWith('[x] ')) {
      const checked = trimmed.startsWith('[x]');
      blocks.push({ id: generateId(), type: 'checklist', content: trimmed.slice(4), checked });
    } else if (trimmed.startsWith('> ')) {
      blocks.push({ id: generateId(), type: 'quote', content: trimmed.slice(2) });
    } else {
      blocks.push({ id: generateId(), type: 'text', style: 'body', content: trimmed });
    }
  }

  if (currentTable) {
    blocks.push({ id: generateId(), type: 'table', tableData: currentTable });
  }

  return blocks.length > 0 ? blocks : [{ id: generateId(), type: 'text', style: 'body', content: '' }];
}
