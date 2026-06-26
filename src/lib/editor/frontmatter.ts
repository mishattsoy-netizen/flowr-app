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

export function parseFrontmatter(mdContent: string): { meta: FrontmatterMeta; body: string } {
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
    (b.textAlign && b.textAlign !== 'left')
  );
}
