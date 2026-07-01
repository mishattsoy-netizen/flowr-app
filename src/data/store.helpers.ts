import type { Entity, EditorBlock, FlowIntentCategory } from './store.types';

let _idCounter = 100;
export function generateId(): string {
  return `e${Date.now()}_${_idCounter++}`;
}

export function getDescendantIds(entities: Entity[], parentId: string): string[] {
  const children = entities.filter(e => e.parentId === parentId);
  let ids: string[] = [];
  for (const c of children) {
    ids.push(c.id);
    ids = ids.concat(getDescendantIds(entities, c.id));
  }
  return ids;
}

/**
 * Every entity belonging to a workspace, found by workspaceId membership
 * (not parentId tree-walking — root-level entities have parentId: null but
 * still carry the owning workspaceId directly).
 */
export function getWorkspaceEntityIds(entities: Entity[], workspaceId: string): string[] {
  return entities.filter(e => e.workspaceId === workspaceId).map(e => e.id);
}

import { inlineMarkdownToHtml } from '@/lib/utils/markdownToBlocks';

export function markdownToBlocks(markdown: string): EditorBlock[] {
  if (!markdown) return [{ id: generateId(), type: 'text', style: 'body', content: '', align: 'left' }];

  const lines = markdown.split(/\r?\n/);
  const blocks: EditorBlock[] = [];

  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length === 0) return;
    blocks.push({
      id: generateId(),
      type: 'table',
      content: '',
      tableData: tableRows,
      align: 'left'
    });
    tableRows = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    if (line.startsWith('|') && line.endsWith('|')) {
      if (/^\|[\s|:-]+\|$/.test(line)) continue;
      const cells = line.slice(1, -1).split('|').map(c => inlineMarkdownToHtml(c.trim()));
      tableRows.push(cells);
      continue;
    } else {
      flushTable();
    }

    if (line === '') continue;

    if (/^#{1}\s*/.test(line) && line.startsWith('# ')) {
      const text = line.slice(2).trim();
      if (!text) continue;
      blocks.push({ id: generateId(), type: 'text', style: 'title', content: inlineMarkdownToHtml(text), align: 'left' });
      continue;
    }

    if (line.startsWith('## ')) {
      const text = line.slice(3).trim();
      if (!text) continue;
      blocks.push({ id: generateId(), type: 'text', style: 'heading', content: inlineMarkdownToHtml(text), align: 'left' });
      continue;
    }

    if (line.startsWith('### ')) {
      const text = line.slice(4).trim();
      if (!text) continue;
      blocks.push({ id: generateId(), type: 'text', style: 'subheading', content: inlineMarkdownToHtml(text), align: 'left' });
      continue;
    }

    if (/^[-*_]{3,}$/.test(line)) {
      blocks.push({ id: generateId(), type: 'divider', content: '', align: 'left' });
      continue;
    }

    if (/^> /.test(line)) {
      const text = line.slice(2).trim();
      if (!text) continue;
      blocks.push({ id: generateId(), type: 'quote', content: inlineMarkdownToHtml(text), align: 'left' });
      continue;
    }

    const checklistMatch = line.match(/^[-*+]?\s*\[([ xX])\]\s+(.*)/);
    if (checklistMatch) {
      const checked = checklistMatch[1].toLowerCase() === 'x';
      const text = checklistMatch[2].trim();
      if (!text) continue;
      blocks.push({ id: generateId(), type: 'checklist', content: inlineMarkdownToHtml(text), checked, align: 'left' });
      continue;
    }

    if (/^[-*+] /.test(line)) {
      const text = line.slice(2).trim();
      if (!text) continue;
      blocks.push({ id: generateId(), type: 'bulletList', content: inlineMarkdownToHtml(text), align: 'left' });
      continue;
    }

    if (/^- /.test(line)) {
      const text = line.slice(2).trim();
      if (!text) continue;
      blocks.push({ id: generateId(), type: 'dashedList', content: inlineMarkdownToHtml(text), align: 'left' });
      continue;
    }

    if (/^\d+\. /.test(line)) {
      const text = line.replace(/^\d+\.\s*/, '').trim();
      if (!text) continue;
      blocks.push({ id: generateId(), type: 'numberedList', content: inlineMarkdownToHtml(text), align: 'left' });
      continue;
    }

    blocks.push({ id: generateId(), type: 'text', style: 'body', content: inlineMarkdownToHtml(line), align: 'left' });
  }

  flushTable();

  return blocks.length > 0
    ? blocks
    : [{ id: generateId(), type: 'text', style: 'body', content: '', align: 'left' }];
}


export function validateNoteContent(content: string): { valid: boolean; reason?: string } {
  if (!content || !content.trim()) {
    return { valid: false, reason: 'Content is empty' };
  }

  const parsedBlocks = markdownToBlocks(content);
  const nonEmptyBlocks = parsedBlocks.filter(b => (b.content || '').trim().length > 0 || b.type === 'divider' || b.type === 'table' || b.type === 'image');
  if (nonEmptyBlocks.length === 0) {
    return { valid: false, reason: 'Content parses to zero non-empty blocks — all headings/lists were empty' };
  }

  const blockPlaceholderPhrases = new Set([
    'list item', 'list item...', 'list item…',
    'heading', 'subheading', 'subtitle',
    'body text', 'paragraph text', 'paragraph',
    'your text here', 'text here', 'enter text',
    'description', 'description goes here',
    'section title', 'section', 'content here', 'content',
    'placeholder', 'body', 'text',
  ]);
  const nonTitleBlocks = nonEmptyBlocks.filter(b => b.style !== 'title');
  if (nonTitleBlocks.length >= 3) {
    const placeholderBlockCount = nonTitleBlocks.filter(b => {
      const t = (b.content || '').trim().toLowerCase().replace(/[\.\…]+$/, '');
      return blockPlaceholderPhrases.has(t);
    }).length;
    const placeholderBlockRatio = placeholderBlockCount / nonTitleBlocks.length;
    if (placeholderBlockRatio >= 0.85) {
      return { valid: false, reason: `${Math.round(placeholderBlockRatio * 100)}% of content blocks are placeholders (e.g. "List item...", "Heading") — no real content written` };
    }
  }

  const textOnly = content
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[-*+]\s*/gm, '')
    .replace(/^\d+\.\s*/gm, '')
    .replace(/^>\s*/gm, '')
    .replace(/^[-*_]{3,}$/gm, '')
    .replace(/\|/g, '')
    .replace(/^---+$/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = textOnly.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) {
    return { valid: false, reason: 'Content contains only markdown syntax with no text' };
  }

  const placeholderWords = new Set([
    'title', 'heading', 'subheading', 'subtitle',
    'list', 'item', 'item...', 'item…',
    'body', 'text', 'here', 'your', 'goes',
    'description', 'section', 'paragraph', 'content',
    'placeholder', 'example', 'sample', 'lorem', 'ipsum',
    'tbd', 'todo', 'n/a', 'na', 'none'
  ]);

  const meaningfulWords = words.filter(w => !placeholderWords.has(w.toLowerCase().replace(/[\.\…]+$/, '')));
  const placeholderRatio = meaningfulWords.length / words.length;

  if (placeholderRatio < 0.2 && meaningfulWords.length < 4) {
    return { valid: false, reason: `Content is ${Math.round((1 - placeholderRatio) * 100)}% placeholder text (found: "${textOnly.substring(0, 100)}")` };
  }

  if (textOnly.length < 30 && meaningfulWords.length < 3) {
    return { valid: false, reason: `Content too short (${textOnly.length} chars) and appears to be a template skeleton` };
  }

  return { valid: true };
}

export function extractTextualToolCalls(content: string): any[] {
  const toolCalls: any[] = [];
  const regex = /(?:!function_call:)?([a-z_]+)\s*(\{[\s\S]*?\})(?=\s*|$)/g;

  let match;
  while ((match = regex.exec(content)) !== null) {
    const name = match[1];
    const argsStr = match[2];

    const knownTools = ["add_note", "add_folder", "add_canvas", "update_note_content", "append_note_content", "generate_image", "web_search", "delete_entity", "rename_entity", "add_task", "delete_task", "complete_task", "update_task", "move_entity", "navigate_to", "read_note", "sort_entities"];

    if (knownTools.includes(name)) {
      toolCalls.push({
        id: `text-tc-${generateId()}`,
        type: 'function',
        function: {
          name: name,
          arguments: argsStr
        }
      });
    }
  }
  return toolCalls;
}

export async function classifyIntent(message: string): Promise<FlowIntentCategory> {
  const lower = message.toLowerCase();

  const toolSignals = /\b(write|create|add|make|new|update|edit|delete|remove|rename|move|save|insert|append|generate image|draw)\b.{0,60}\b(note|page|folder|canvas|task|heading|block|content|entry)\b|\b(note|folder|canvas|task)\b.{0,40}\b(called|named|titled|about)\b/i;
  if (toolSignals.test(message)) return 'tool_call';

  if (/\b(generate|create|make|draw|show me|paint)\b.{0,40}\b(image|picture|photo|art|graphic|illustration|sketch|portrait|landscape)\b/i.test(lower)) return 'image_generation';

  if (/\b(transcribe|listen|audio|voice|sound|speech|speak|talk|whisper|tts|text to speech|recording)\b/i.test(lower)) return 'audio_voice';

  const searchSignals = /\b(search|look up|find out|what is .{0,30}today|latest|current|news|recent|who is|where is|when (did|is|was)|price of|weather)\b/i;
  if (searchSignals.test(message)) return 'web_search';

  const complexSignals = /\b(analyze|analyse|explain in depth|essay|research|compare|evaluate|pros and cons|strategy|plan|argue|thesis|critique|philosophy|how does.{0,40}work|why does|implications|impact of)\b/i;
  if (complexSignals.test(message) || message.length > 400) return 'complex';

  if (message.length < 60 && !/\b(explain|describe|summarize|write|create|list all|give me|tell me about)\b/i.test(lower)) return 'fast';

  return 'medium';
}

export function robustParseJSON(jsonStr: string): any {
  if (!jsonStr) return {};

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    let sanitized = jsonStr.trim();

    try {
      sanitized = sanitized.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match, p1) => {
        return '"' + p1.replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
      });
      return JSON.parse(sanitized);
    } catch (e2) {
      try {
        sanitized = sanitized.replace(/,(\s*[\]}])/g, '$1');

        let temp = sanitized;

        const doubleQuotes = (temp.match(/"/g) || []).length;
        if (doubleQuotes % 2 !== 0) temp += '"';

        const openBraces = (temp.match(/\{/g) || []).length;
        const closeBraces = (temp.match(/\}/g) || []).length;
        for (let i = 0; i < openBraces - closeBraces; i++) temp += '}';

        const openBrackets = (temp.match(/\[/g) || []).length;
        const closeBrackets = (temp.match(/\]/g) || []).length;
        for (let i = 0; i < openBrackets - closeBrackets; i++) temp += ']';

        return JSON.parse(temp);
      } catch (e3) {
        try {
          const sanitized2 = sanitized
            .replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3')
            .replace(/'/g, '"');
          return JSON.parse(sanitized2);
        } catch (e4) {
          console.error('[Flowr AI] robustParseJSON failed to fix JSON:', e, '\nInput:', jsonStr.substring(0, 500));
          throw e;
        }
      }
    }
  }
}

export function blocksToMarkdown(blocks: EditorBlock[]): string {
  if (!blocks || blocks.length === 0) return '';

  const lines: string[] = [];
  let numberedIndex = 1;
  for (const b of blocks) {
    switch (b.type) {
      case 'text':
        if (b.style === 'title') lines.push(`# ${b.content}`);
        else if (b.style === 'heading') lines.push(`## ${b.content}`);
        else if (b.style === 'subheading') lines.push(`### ${b.content}`);
        else if (b.style === 'mono') lines.push(`\`\`\`\n${b.content}\n\`\`\``);
        else lines.push(b.content || '');
        numberedIndex = 1;
        break;
      case 'table':
        if (b.tableData && b.tableData.length > 0) {
          const rows = b.tableData.map(row => `| ${row.join(' | ')} |`);
          const headerCount = b.tableData[0].length;
          const separator = `| ${Array(headerCount).fill('---').join(' | ')} |`;
          rows.splice(1, 0, separator);
          lines.push(rows.join('\n'));
        }
        numberedIndex = 1;
        break;
      case 'divider':
        lines.push('---');
        numberedIndex = 1;
        break;
      case 'quote':
        lines.push(`> ${b.content}`);
        numberedIndex = 1;
        break;
      case 'bulletList':
      case 'dashedList':
        lines.push(`- ${b.content}`);
        numberedIndex = 1;
        break;
      case 'numberedList':
        lines.push(`${numberedIndex}. ${b.content}`);
        numberedIndex++;
        break;
      case 'checklist':
        lines.push(`[${b.checked ? 'x' : ' '}] ${b.content}`);
        numberedIndex = 1;
        break;
      case 'image':
        lines.push(`![Image](${b.content})`);
        numberedIndex = 1;
        break;
      default:
        lines.push(b.content || '');
        numberedIndex = 1;
    }
  }
  return lines.join('\n');
}
