# Adaptive Formatting & Notes Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement adaptive formatting rules for AI responses, context-aware "Copy to Note" buttons, markdown-to-block parsing, and Notion-style editor shortcuts including accurate table conversions.

**Architecture:** Modifies system prompts for the AI to dynamically adapt formatting. Adds a new Markdown parser utility that converts raw AI responses into the custom block format used by `NoteEditor.tsx`, specifically handling tables. Updates `ChatMessage` UI to show actions, and `BlockRenderer` to intercept keystrokes for shortcuts.

**Tech Stack:** React, TailwindCSS, Radix UI, TypeScript

---

### Task 1: Update AI Modes for Adaptive Formatting

**Files:**
- Modify: `mode-default.txt:40-60`
- Modify: `mode-pro.txt:43-63`

**Step 1: Write the updated rules**
Modify the `[ANSWER STYLE]` in both files to remove the "Do not use headers for short answers" rule and replace it with:
```
Length calibration is your primary tool for formatting:
- Adapt formatting richness to the length and complexity of your answer.
- For quick facts or simple conversations, use standard prose without excessive headers.
- For complex analysis, multi-step logic, or long answers, actively use markdown headers (###), bold subheadings, and horizontal dividers (---) to create a scannable hierarchy.
- Use bullet points (-), numbered lists (1.), and to-do lists ([ ]) extensively.
- Use markdown blockquotes (>) for quoted text or important callouts.
- You must use code blocks for all code, terminal commands, file paths, and filenames.
- You must use markdown tables for comparisons or structured data. Format them strictly.
```

**Step 2: Commit**
```bash
git add mode-default.txt mode-pro.txt
git commit -m "feat: update AI modes for adaptive formatting"
```

---

### Task 2: Create Markdown-to-Blocks Parser

**Files:**
- Create: `src/lib/utils/markdownToBlocks.ts`

**Step 1: Write the implementation**
```typescript
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
```

**Step 2: Commit**
```bash
git add src/lib/utils/markdownToBlocks.ts
git commit -m "feat: implement markdown to blocks parser"
```

---

### Task 3: ChatMessage "Copy to Note" UI

**Files:**
- Modify: `src/components/assistant/components/ChatMessage.tsx`

**Step 1: Write the implementation**
Update `ChatMessage.tsx` to detect rich formatting and show a Radix Split-Button using `useStore` to check for active notes.

```tsx
// Imports to add
import { useStore, generateId } from '@/data/store';
import { parseMarkdownToBlocks } from '@/lib/utils/markdownToBlocks';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, FileText, ClipboardCopy } from 'lucide-react';

// Inside ChatMessage component
const activeEntityId = useStore(s => s.activeEntityId);
const createEntity = useStore(s => s.createEntity);
const getEntityById = useStore(s => s.getEntityById);
const updateEntity = useStore(s => s.updateEntity);

const hasRichFormatting = msg.role === 'assistant' && (
  msg.content.includes('\n### ') || 
  msg.content.includes('\n---') || 
  msg.content.includes('|---|')
);

const activeNote = activeEntityId ? getEntityById(activeEntityId) : null;
const isNoteActive = activeNote?.type === 'note' || activeNote?.type === 'mixed';

const handleCopyToNote = (asNew: boolean = false) => {
  const blocks = parseMarkdownToBlocks(msg.content);
  if (isNoteActive && !asNew) {
    const newBlocks = [...(activeNote.blocks || []), ...blocks];
    updateEntity(activeNote.id, { blocks: newBlocks });
  } else {
    const titleBlock = blocks.find(b => b.style === 'title' || b.style === 'heading' || b.style === 'subheading');
    const title = titleBlock ? titleBlock.content : 'AI Note - ' + new Date().toLocaleDateString();
    createEntity('note', { title, blocks });
  }
};

const handleCopyMarkdown = () => {
  navigator.clipboard.writeText(msg.content);
};

// Render below the markdown content in ChatMessage
{hasRichFormatting && (
  <div className="mt-4 flex items-center">
    <div className="flex bg-accent text-accent-foreground rounded-md overflow-hidden text-xs font-semibold">
      <button 
        onClick={() => handleCopyToNote()} 
        className="px-3 py-1.5 hover:bg-white/20 flex items-center gap-1.5"
      >
        <FileText className="w-3.5 h-3.5" />
        {isNoteActive ? 'Copy to Note' : 'Create Note'}
      </button>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="px-2 py-1.5 border-l border-white/20 hover:bg-white/20">
          <ChevronDown className="w-3.5 h-3.5" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="bg-sidebar border border-border rounded-md shadow-lg p-1 min-w-[160px] z-50 text-xs">
            <DropdownMenu.Item onSelect={() => handleCopyToNote(true)} className="flex items-center gap-2 px-2 py-1.5 outline-none hover:bg-hover rounded-sm cursor-pointer">
              <FileText className="w-3.5 h-3.5" /> Create as new Note
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={handleCopyMarkdown} className="flex items-center gap-2 px-2 py-1.5 outline-none hover:bg-hover rounded-sm cursor-pointer">
              <ClipboardCopy className="w-3.5 h-3.5" /> Copy raw Markdown
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  </div>
)}
```

**Step 2: Commit**
```bash
git add src/components/assistant/components/ChatMessage.tsx
git commit -m "feat: add copy to note split button in chat message"
```

---

### Task 4: Notion-Style Editor Shortcuts

**Files:**
- Modify: `src/components/editor/BlockRenderer.tsx`

**Step 1: Write the implementation**
Inside `handleKeyDown` in `BlockRenderer.tsx`, intercept `Space` to transform the block type.

```tsx
// Inside handleKeyDown, add this before the Backspace handler
if (e.key === ' ' && contentRef.current) {
  const text = contentRef.current.textContent ?? '';
  
  const transform = (updates: Partial<EditorBlock>) => {
    e.preventDefault();
    onUpdate(block.id, { content: '', ...updates });
  };

  if (text === '#') transform({ type: 'text', style: 'title' });
  else if (text === '##') transform({ type: 'text', style: 'heading' });
  else if (text === '###') transform({ type: 'text', style: 'subheading' });
  else if (text === '-') transform({ type: 'bulletList' });
  else if (text === '1.') transform({ type: 'numberedList' });
  else if (text === '[]') transform({ type: 'checklist', checked: false });
  else if (text === '"' || text === '>') transform({ type: 'quote' });
  else if (text === '```') transform({ type: 'text', style: 'mono' });
  else if (text === '---') transform({ type: 'divider' });
  else if (text === '/table' || text === '|') transform({ type: 'table', tableData: [['', '', ''], ['', '', ''], ['', '', '']] });
}
```

**Step 2: Commit**
```bash
git add src/components/editor/BlockRenderer.tsx
git commit -m "feat: add Notion-style shortcuts to editor"
```
