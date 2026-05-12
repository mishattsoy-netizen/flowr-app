import { EditorBlock, BlockType, BlockStyle } from '@/data/store.types';
import { generateId } from '@/data/store.helpers';

export type BlockInput = {
  type: BlockType;
  content?: string;
  style?: BlockStyle;
  checked?: boolean;
  children?: BlockInput[];
};

export function looksLikeMarkdown(text: string): boolean {
  if (!text.trim()) return false;
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const mdLineRe = /^(\s*)(-|\*|\d+\.|[a-z]+\.|[ivxlcdm]+\.|#{1,3} |\[[ x]\] |>)/;
  const matches = lines.filter(l => mdLineRe.test(l));
  return matches.length >= 2;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineToHtml(text: string): string {
  let s = escapeHtml(text);
  // inline code first (no further processing inside)
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // bold
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italic (single * or _)
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
  // links
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s;
}

type LineKind =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'numbered'; text: string }
  | { kind: 'checklist'; checked: boolean; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'fenceOpen' }
  | { kind: 'fenceClose' }
  | { kind: 'divider' }
  | { kind: 'text'; text: string }
  | { kind: 'blank' };

function classifyLine(raw: string): { indent: number; kind: LineKind } {
  // Measure indent: normalize tabs to 2 spaces, count leading spaces, floor to 2-space levels
  const normalized = raw.replace(/\t/g, '  ');
  const spaceMatch = normalized.match(/^( *)/);
  const leadingSpaces = spaceMatch ? spaceMatch[1].length : 0;
  const indent = Math.floor(leadingSpaces / 2);
  // Strip exactly the measured indentation plus any odd trailing space
  const line = normalized.slice(leadingSpaces).trimStart();

  if (line === '') return { indent, kind: { kind: 'blank' } };
  if (line === '---') return { indent, kind: { kind: 'divider' } };
  if (line.startsWith('```')) return { indent, kind: { kind: 'fenceOpen' } };

  const h = line.match(/^(#{1,3}) (.+)/);
  if (h) return { indent, kind: { kind: 'heading', level: h[1].length as 1|2|3, text: h[2] } };

  const bullet = line.match(/^[-*] (.+)/);
  if (bullet) return { indent, kind: { kind: 'bullet', text: bullet[1] } };

  // Only match numeric list markers (1., 2., 3.) - not alpha/roman which over-matches prose
  const numbered = line.match(/^\d+\. (.+)/);
  if (numbered) return { indent, kind: { kind: 'numbered', text: numbered[1] } };

  const check = line.match(/^\[([ x])\] (.+)/);
  if (check) return { indent, kind: { kind: 'checklist', checked: check[1] === 'x', text: check[2] } };

  const quote = line.match(/^> (.+)/);
  if (quote) return { indent, kind: { kind: 'quote', text: quote[1] } };

  return { indent, kind: { kind: 'text', text: line } };
}

export function parseMarkdownToBlocks(md: string): EditorBlock[] {
  if (!md.trim()) return [];

  const lines = md.split('\n');
  const root: EditorBlock[] = [];
  const stack: Array<{ block: EditorBlock; depth: number }> = [];
  let inFence = false;
  let fenceLines: string[] = [];

  const pushBlock = (block: EditorBlock, depth: number) => {
    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }
    if (stack.length === 0) {
      root.push(block);
    } else {
      const parent = stack[stack.length - 1].block;
      if (!parent.children) parent.children = [];
      parent.children.push(block);
    }
    stack.push({ block, depth });
  };

  for (const rawLine of lines) {
    if (inFence) {
      if (rawLine.trim() === '```') {
        inFence = false;
        const monoBlock: EditorBlock = {
          id: generateId(),
          type: 'text',
          content: fenceLines.join('\n'),
          style: 'mono',
        };
        pushBlock(monoBlock, 0);
        fenceLines = [];
      } else {
        fenceLines.push(rawLine);
      }
      continue;
    }

    const { indent, kind } = classifyLine(rawLine);

    if (kind.kind === 'blank') continue;
    if (kind.kind === 'fenceOpen') { inFence = true; fenceLines = []; continue; }
    if (kind.kind === 'fenceClose') { inFence = false; continue; }

    let block: EditorBlock;

    switch (kind.kind) {
      case 'heading': {
        const styleMap: Record<1|2|3, BlockStyle> = { 1: 'title', 2: 'heading', 3: 'subheading' };
        block = { id: generateId(), type: 'text', content: inlineToHtml(kind.text), style: styleMap[kind.level] };
        break;
      }
      case 'bullet':
        block = { id: generateId(), type: 'bulletList', content: inlineToHtml(kind.text) };
        break;
      case 'numbered':
        block = { id: generateId(), type: 'numberedList', content: inlineToHtml(kind.text) };
        break;
      case 'checklist':
        block = { id: generateId(), type: 'checklist', content: inlineToHtml(kind.text), checked: kind.checked };
        break;
      case 'quote':
        block = { id: generateId(), type: 'quote', content: inlineToHtml(kind.text) };
        break;
      case 'divider':
        block = { id: generateId(), type: 'divider', content: '' };
        break;
      case 'text':
      default:
        block = { id: generateId(), type: 'text', content: inlineToHtml(kind.text), style: 'body' };
        break;
    }

    pushBlock(block, indent);
  }

  return root;
}

export function blocksToMarkdown(_blocks: EditorBlock[]): string {
  throw new Error('not implemented');
}

export function normalizeBlocks(_input: BlockInput[]): EditorBlock[] {
  throw new Error('not implemented');
}

export function formatCounter(n: number, style: 'arabic' | 'alpha' | 'roman'): string {
  if (style === 'arabic') return String(n);

  if (style === 'alpha') {
    let result = '';
    let num = n;
    while (num > 0) {
      num--;
      result = String.fromCharCode(97 + (num % 26)) + result;
      num = Math.floor(num / 26);
    }
    return result;
  }

  // roman
  const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const syms = ['m','cm','d','cd','c','xc','l','xl','x','ix','v','iv','i'];
  let result = '';
  let num = n;
  for (let i = 0; i < vals.length; i++) {
    while (num >= vals[i]) {
      result += syms[i];
      num -= vals[i];
    }
  }
  return result;
}
