# Flowr Local-First M3: Electron Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wrap Next.js app in Electron desktop shell with file I/O for notes and canvases.

**Architecture:** Electron main process spawns Next.js dev server/production server. Preload exposes filesystem API.

**Tech Stack:** Electron, Node.js `fs`

---

### Task 1: Environment Detection

**Files:**
- Create: `src/lib/env.ts`

**Step 1: Write implementation**

Create `src/lib/env.ts`:

```typescript
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__FLOWR_DESKTOP__;
}

export function isWeb(): boolean {
  return !isDesktop();
}
```

**Step 2: Commit**

```bash
git add src/lib/env.ts
git commit -m "feat: add environment detection for desktop"
```

---

### Task 2: Electron Main Process & Preload

**Files:**
- Create: `electron/main.js`
- Create: `electron/preload.js`
- Modify: `package.json`

**Step 1: Write main.js**

Create `electron/main.js`:

```javascript
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { spawn } = require('child_process');

let mainWindow;
let nextProcess;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const { session } = require('electron');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:* https://*.supabase.co https://fonts.googleapis.com https://fonts.gstatic.com"]
      }
    });
  });

  // For dev: connect to existing Next.js server on 3000
  mainWindow.loadURL('http://localhost:3000');
}

app.whenReady().then(() => {
  ipcMain.handle('fs:readFile', async (_, filePath) => fs.readFile(filePath, 'utf-8'));
  ipcMain.handle('fs:writeFile', async (_, filePath, content) => fs.writeFile(filePath, content, 'utf-8'));
  ipcMain.handle('fs:deleteFile', async (_, filePath) => fs.unlink(filePath));
  ipcMain.handle('fs:readdir', async (_, dirPath) => fs.readdir(dirPath));
  ipcMain.handle('fs:mkdir', async (_, dirPath) => fs.mkdir(dirPath, { recursive: true }));
  ipcMain.handle('dialog:pickVaultFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    return result.filePaths[0] || null;
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (nextProcess) nextProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
```

**Step 2: Write preload.js**

Create `electron/preload.js`:

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__FLOWR_DESKTOP__', true);

contextBridge.exposeInMainWorld('flowrFS', {
  readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path, content) => ipcRenderer.invoke('fs:writeFile', path, content),
  deleteFile: (path) => ipcRenderer.invoke('fs:deleteFile', path),
  readdir: (path) => ipcRenderer.invoke('fs:readdir', path),
  mkdir: (path) => ipcRenderer.invoke('fs:mkdir', path),
  pickVaultFolder: () => ipcRenderer.invoke('dialog:pickVaultFolder'),
});
```

**Step 3: Update package.json scripts**

In `package.json`:
```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "electron:dev": "electron electron/main.js"
  }
```

Install electron:
```bash
npm install -D electron@latest
```

**Step 4: Commit**

```bash
git add electron/ package.json
git commit -m "feat: add basic Electron shell and preload bridge"
```

---

### Task 3: File Vault Utilities

**Files:**
- Create: `src/lib/fileVault.ts`

**Step 1: Write implementation**

Create `src/lib/fileVault.ts`:

```typescript
export async function getVaultPath(): Promise<string | null> {
  return localStorage.getItem('flowr_vault_path');
}

export async function setVaultPath(path: string): Promise<void> {
  localStorage.setItem('flowr_vault_path', path);
}

export function sanitizeFileName(title: string): string {
  let clean = title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-');
  const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  if (reserved.test(clean)) clean = clean + '_';
  return clean.trim().substring(0, 120) || 'Untitled';
}

export async function pickVaultFolder(): Promise<string | null> {
  if (typeof window === 'undefined' || !(window as any).flowrFS) return null;
  const path = await (window as any).flowrFS.pickVaultFolder();
  if (path) await setVaultPath(path);
  return path;
}
```

**Step 2: Commit**

```bash
git add src/lib/fileVault.ts
git commit -m "feat: add file vault path management and sanitization"
```

---

### Task 4: Store Persistence Adapter

**Files:**
- Create: `src/lib/persistence.ts`
- Modify: `src/data/store.ts`

**Step 1: Write persistence module**

Create `src/lib/persistence.ts`:

```typescript
import { Entity, AppTask } from '@/data/store.types';
import { isDesktop } from './env';
import { getVaultPath, sanitizeFileName } from './fileVault';
import { serializeFrontmatter, needsBlockBackup } from './editor/frontmatter';

export async function saveEntityToFile(entity: Entity, blocks: any[]): Promise<void> {
  if (!isDesktop() || !(window as any).flowrFS) return;
  const vault = await getVaultPath();
  if (!vault) return;

  const fileName = sanitizeFileName(entity.title) + (entity.type === 'canvas' ? '.canvas' : '.md');
  const filePath = `${vault}/${fileName}`; // simplified for M3, will use folders later

  let content = '';
  if (entity.type === 'canvas') {
    content = JSON.stringify({ entity, blocks }, null, 2);
  } else {
    const meta = {
      id: entity.id,
      title: entity.title,
      syncMode: 'full-sync', // M3 default
      lastModified: entity.lastModified,
      version: 1,
      blocks: needsBlockBackup(blocks) ? blocks : undefined
    };
    content = serializeFrontmatter(meta) + '\n\n' + 'Content here (via blocksToMarkdown)';
  }

  await (window as any).flowrFS.writeFile(filePath, content);
}
```

**Step 2: Attach to Zustand**

In `src/data/store.ts`, at the very end of the file:

```typescript
import { isDesktop } from '@/lib/env';
import { saveEntityToFile } from '@/lib/persistence';

if (isDesktop()) {
  useStore.subscribe((state, prevState) => {
    // Basic detection for M3: if lastModified changed, save it
    // In M4 this will be replaced by direct calls to saveEntity() on store actions
    for (const entity of state.entities) {
      const prev = prevState.entities.find(e => e.id === entity.id);
      if (!prev || prev.lastModified !== entity.lastModified) {
        saveEntityToFile(entity, state.blocks.filter(b => b.canvasId === entity.id));
      }
    }
  });
}
```

**Step 3: Commit**

```bash
git add src/data/store.ts src/lib/persistence.ts
git commit -m "feat: attach file persistence to Zustand store"
```

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-06-27-local-first-m3-electron.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
