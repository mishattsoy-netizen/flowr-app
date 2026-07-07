import { EditorBlock } from '@/data/store.types';

// Renders the block tree to plain, semantic, read-only HTML for PDF export.
// Deliberately does not reuse BlockRenderer: that component renders interactive editor
// chrome (drag handles, hover controls, contentEditable, nested flex wrappers) which
// confuses paged.js's layout/fragmentation math and can't fragment mid-block. block.content
// is already inline HTML (see inlineToHtml in markdownBlocks.ts), so it's used directly.

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderTable(block: EditorBlock): string {
  const data = block.tableData ?? [];
  if (data.length === 0) return '';
  const [header, ...rows] = data;
  const theadHtml = `<thead><tr>${header.map(c => `<th>${c}</th>`).join('')}</tr></thead>`;
  const tbodyHtml = rows.length
    ? `<tbody>${rows.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`
    : '';
  return `<table class="pdf-export-table">${theadHtml}${tbodyHtml}</table>`;
}

function renderListItems(blocks: EditorBlock[], type: 'bulletList' | 'numberedList' | 'dashedList' | 'checklist'): string {
  const tag = type === 'numberedList' ? 'ol' : 'ul';
  const cls = type === 'dashedList' ? ' class="pdf-export-dashed"' : '';

  const li = (b: EditorBlock, inner: string) => {
    if (type === 'checklist') {
      // The nested list must sit in the content column (not directly in the flex li,
      // where it would land beside the text instead of below it).
      return `<li class="pdf-export-checklist-item${b.checked ? ' checked' : ''}"><span class="pdf-export-checkbox">${b.checked ? '☑' : '☐'}</span><div>${b.content}${inner}</div></li>`;
    }
    return `<li>${b.content}${inner}</li>`;
  };

  // Grandchildren and deeper nest normally: a child <ul>/<ol> inside the <li>.
  const renderNested = (b: EditorBlock): string => {
    const kids = b.children?.length ? `<${tag}${cls}>${b.children.map(renderNested).join('')}</${tag}>` : '';
    return li(b, kids);
  };

  // The editor's ListBlock flattens a list block's DIRECT children onto the same visual
  // depth as the block's own content row (flattenRows pushes the root at depth 0 and then
  // walks block.children also starting at depth 0 - see ListBlock.tsx). Mirror that: each
  // block's own <li> is followed by its children as sibling <li>s in the same list, and
  // only the levels below those nest one step deeper.
  const items = blocks.map(b =>
    li(b, '') + (b.children ?? []).map(renderNested).join('')
  ).join('');

  return `<${tag}${cls}>${items}</${tag}>`;
}

function renderChildren(block: EditorBlock): string {
  if (!block.children || block.children.length === 0) return '';
  return renderBlocks(block.children);
}

function renderBlock(block: EditorBlock, siblings: EditorBlock[], index: number): string {
  switch (block.type) {
    case 'text': {
      const tag = block.style === 'title' ? 'h1'
        : block.style === 'heading' ? 'h2'
        : block.style === 'subheading' ? 'h3'
        : block.style === 'mono' ? 'pre'
        : 'p';
      if (tag === 'pre') {
        return `<pre class="pdf-export-code"><code>${block.content}</code></pre>`;
      }
      return `<${tag}>${block.content}</${tag}>${renderChildren(block)}`;
    }
    case 'quote':
      return `<blockquote>${block.content}${renderChildren(block)}</blockquote>`;
    case 'divider':
      return `<hr />`;
    case 'table':
      return renderTable(block);
    case 'bulletList':
    case 'dashedList':
    case 'numberedList':
    case 'checklist': {
      // Group consecutive siblings of the same list type into one <ul>/<ol>.
      const prevSibling = siblings[index - 1];
      if (prevSibling && prevSibling.type === block.type) return '';
      const group: EditorBlock[] = [block];
      for (let i = index + 1; i < siblings.length && siblings[i].type === block.type; i++) {
        group.push(siblings[i]);
      }
      return renderListItems(group, block.type);
    }
    case 'columns': {
      const cols = (block.children ?? []).map(col => `<div class="pdf-export-column">${renderBlocks(col.children ?? [])}</div>`).join('');
      return `<div class="pdf-export-columns">${cols}</div>`;
    }
    case 'image':
      return block.mediaUrl
        ? `<figure class="pdf-export-figure"><img src="${escapeHtml(block.mediaUrl)}" alt="" />${block.mediaCaption ? `<figcaption>${escapeHtml(block.mediaCaption)}</figcaption>` : ''}</figure>`
        : '';
    case 'link':
      return `<p>${block.content}</p>`;
    default:
      return block.content ? `<p>${block.content}</p>` : '';
  }
}

function renderBlocks(blocks: EditorBlock[]): string {
  return blocks.map((b, i) => renderBlock(b, blocks, i)).join('');
}

export function blocksToExportHtml(blocks: EditorBlock[]): string {
  return renderBlocks(blocks);
}
