# Flowr Local-First M2: Markdown Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build pure library layer for EditorBlock to Markdown conversion with frontmatter and column support.

**Architecture:** Pure functions parsing and serializing text, zero dependencies (`js-yaml` avoided to prevent deserialization vulnerabilities and keep bundle small).

**Tech Stack:** TypeScript, Vitest

---

### Task 1: Frontmatter Engine (TDD)

**Files:**
- Create: `src/lib/editor/frontmatter.test.ts`
- Create: `src/lib/editor/frontmatter.ts`

**Step 1: Write the failing test**

Create `src/lib/editor/frontmatter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { serializeFrontmatter, parseFrontmatter, needsBlockBackup, stripBom, sanitizeObject } from './frontmatter';

describe('Frontmatter Engine', () => {
  it('serializes and parses meta correctly without loss', () => {
    const meta = { id: '123', title: 'Test Note', syncMode: 'cloud-only', lastModified: 1000, version: 1 };
    const md = serializeFrontmatter(meta) + "\n\nBody text";
    
    const parsed = parseFrontmatter(md);
    expect(parsed.meta.id).toBe('123');
    expect(parsed.meta.title).toBe('Test Note');
    expect(parsed.body).toBe('Body text');
  });

  it('handles missing frontmatter gracefully', () => {
    const parsed = parseFrontmatter("Just some text");
    expect(parsed.meta.id).toBeUndefined();
    expect(parsed.body).toBe("Just some text");
  });

  it('strips BOM and sanitizes proto', () => {
    const text = '\uFEFFHello';
    expect(stripBom(text)).toBe('Hello');
    
    const obj = JSON.parse('{"__proto__": {"hacked": true}, "a": 1}');
    const clean = sanitizeObject(obj);
    expect((clean as any).__proto__.hacked).toBeUndefined();
  });

  it('identifies if block backup is needed', () => {
    expect(needsBlockBackup([{ id: '1', type: 'paragraph', content: 'test' }])).toBe(false);
    expect(needsBlockBackup([{ id: '1', type: 'columns', content: '' }])).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test run src/lib/editor/frontmatter.test.ts`
Expected: FAIL (Cannot find module)

**Step 3: Write minimal implementation**

Create `src/lib/editor/frontmatter.ts`:

```typescript
import { EditorBlock } from '@/data/store.types';

export interface FrontmatterMeta {
  id: string;
  title: string;
  syncMode: string;
  lastModified: number;
  version: number;
  tags?: string[];
  workspaceId?: string;
  blocks?: EditorBlock[];
}

export function stripBom(content: string): string {
  if (content.charCodeAt(0) === 0xFEFF) return content.slice(1);
  return content;
}

export function sanitizeObject<T>(obj: T): T {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject) as unknown as T;
  
  const clean: any = {};
  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    clean[key] = sanitizeObject((obj as any)[key]);
  }
  return clean;
}

export function serializeFrontmatter(meta: FrontmatterMeta): string {
  let yaml = '---\n';
  for (const [k, v] of Object.entries(meta)) {
    if (v !== undefined) {
      yaml += `${k}: ${JSON.stringify(v)}\n`;
    }
  }
  return yaml + '---';
}

export function parseFrontmatter(mdContent: string): { meta: FrontmatterMeta, body: string } {
  const normalized = stripBom(mdContent).replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  
  if (!match) {
    return { meta: {} as FrontmatterMeta, body: normalized.trim() };
  }
  
  const meta: any = {};
  const lines = match[1].split('\n');
  
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const valStr = line.slice(idx + 1).trim();
      try {
        meta[key] = sanitizeObject(JSON.parse(valStr));
      } catch (e) {
        // Fallback for unquoted strings if needed, but we serialize with JSON.stringify
        meta[key] = valStr;
      }
    }
  }
  
  return { meta: meta as FrontmatterMeta, body: match[2].trim() };
}

export function needsBlockBackup(blocks: EditorBlock[]): boolean {
  return blocks.some(b => 
    b.type === 'columns' || 
    b.type === 'shape' || 
    b.type === 'comment' || 
    b.type === 'section' || 
    b.type === 'connection' ||
    b.textAlign && b.textAlign !== 'left'
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test run src/lib/editor/frontmatter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/editor/frontmatter.test.ts src/lib/editor/frontmatter.ts
git commit -m "feat: add robust frontmatter parsing and serialization"
```

---

### Task 2: Column Markdown Syntax (TDD)

**Files:**
- Create: `src/lib/editor/columnsMarkdown.test.ts`
- Create: `src/lib/editor/columnsMarkdown.ts`

**Step 1: Write the failing test**

Create `src/lib/editor/columnsMarkdown.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseColumnFences, serializeColumns } from './columnsMarkdown';

describe('Columns Markdown', () => {
  it('parses column fences correctly', () => {
    const lines = [
      '::: columns',
      '::: column',
      'Left text',
      ':::',
      '::: column',
      'Right text',
      ':::',
      '::::',
      'Outside text'
    ];
    
    const res = parseColumnFences(lines, 0);
    expect(res).not.toBeNull();
    expect(res?.endIndex).toBe(7); // Index of '::::'
    expect(res?.columnContents.length).toBe(2);
    expect(res?.columnContents[0]).toEqual(['Left text']);
    expect(res?.columnContents[1]).toEqual(['Right text']);
  });

  it('rejects nested columns', () => {
    const lines = ['::: columns', '::: column', '::: columns', ':::', '::::'];
    const res = parseColumnFences(lines, 0);
    expect(res).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test run src/lib/editor/columnsMarkdown.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

Create `src/lib/editor/columnsMarkdown.ts`:

```typescript
export function parseColumnFences(lines: string[], startIndex: number) {
  if (lines[startIndex] !== '::: columns') return null;
  
  const columnContents: string[][] = [];
  let currentColumn: string[] | null = null;
  let endIndex = startIndex + 1;
  let hasNestedError = false;

  while (endIndex < lines.length) {
    const line = lines[endIndex];
    
    if (line === '::::') {
      if (currentColumn !== null) {
        // Unclosed column before group closes
        columnContents.push(currentColumn);
      }
      break;
    }
    
    if (line === '::: columns') {
      hasNestedError = true;
      break;
    }
    
    if (line === '::: column') {
      if (currentColumn !== null) {
        columnContents.push(currentColumn);
      }
      currentColumn = [];
    } else if (line === ':::') {
      if (currentColumn !== null) {
        columnContents.push(currentColumn);
        currentColumn = null;
      }
    } else if (currentColumn !== null) {
      currentColumn.push(line);
    }
    
    endIndex++;
  }

  if (hasNestedError || endIndex >= lines.length || lines[endIndex] !== '::::') {
    return null;
  }

  return { columnContents, endIndex };
}

export function serializeColumns(columnBlocksMarkdown: string[]): string {
  let md = '::: columns\n';
  for (const col of columnBlocksMarkdown) {
    md += '::: column\n' + col + '\n:::\n';
  }
  md += '::::';
  return md;
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test run src/lib/editor/columnsMarkdown.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/editor/columnsMarkdown.test.ts src/lib/editor/columnsMarkdown.ts
git commit -m "feat: add column markdown syntax support"
```

---

### Task 3: Pill Link Import

**Files:**
- Modify: `src/lib/editor/markdownBlocks.test.ts`
- Modify: `src/lib/editor/markdownBlocks.ts`

**Step 1: Write the failing test**

In `src/lib/editor/markdownBlocks.test.ts`, add:

```typescript
import { parseMarkdownToBlocks } from './markdownBlocks';

// ... inside describe block:
it('parses pill links correctly', () => {
  const md = 'Here is a [pill:Doc Name](doc-id)';
  const blocks = parseMarkdownToBlocks(md);
  expect(blocks[0].content).toContain('<a href="doc-id" data-type="entity-link" data-id="doc-id" class="entity-pill">Doc Name</a>');
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test run src/lib/editor/markdownBlocks.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

In `src/lib/editor/markdownBlocks.ts`, locate the inline parsing logic (or add a pre-processing step before marked parses it, or intercept in `inlineToHtml`). Add this regex replacement:

```typescript
function processInlineFormatting(text: string): string {
  // Existing formatting logic...
  
  // Add pill link support
  // Turns [pill:Label Name](entity-id) into the proper HTML anchor
  let processed = text.replace(/\[pill:([^\]]+)\]\(([^)]+)\)/g, (match, label, id) => {
    // Basic escaping to prevent injection
    const safeId = id.replace(/"/g, '&quot;');
    const safeLabel = label.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<a href="${safeId}" data-type="entity-link" data-id="${safeId}" class="entity-pill">${safeLabel}</a>`;
  });
  
  return processed;
}
```
*(Note: adjust exactly where this fits in the existing `markdownBlocks.ts` pipeline, but the regex is correct).*

**Step 4: Run test to verify it passes**

Run: `npm run test run src/lib/editor/markdownBlocks.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/editor/markdownBlocks.ts src/lib/editor/markdownBlocks.test.ts
git commit -m "feat: support pill link markdown import"
```

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-06-27-local-first-m2-markdown.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
