# Flowr — Project Summary

**Flowr** (beta) is a visual-first productivity and knowledge workspace — think of it as a "second brain" app that combines note-taking, task management, an infinite whiteboard canvas, an AI assistant, and a customizable dashboard, all in one place.

It runs in the **browser** (as a web app) and as a **desktop app** (built with Electron for Windows, macOS, and Linux). You can use it entirely in the cloud, entirely offline on your local file system, or a mix of both.

---

## What Can You Do With It?

### Take Notes
A rich text editor with block-based editing — headings, lists, checklists, quotes, tables, columns, dividers, images, videos, and links. Type `/` to pull up a slash command menu to insert anything. Notes can be exported to and imported from Markdown.

### Draw on an Infinite Canvas
An infinite whiteboard where you can drop text blocks, shapes (rectangles, ellipses, diamonds), images, arrows, lines, and freehand drawings. Arrows stick to shapes and move with them. You can group things into frames, reorder layers, snap to grid, undo/redo, and export your canvas as PNG, JPG, or SVG.

### Manage Tasks ("Tracker")
A Kanban-style task board with columns: Todo, In Progress, Today, Overdue, Completed. Drag tasks between columns, add subtasks, tags, priorities, difficulty ratings, and due dates. Open a detailed inspector panel for any task. Select multiple tasks to batch-edit them.

### Chat with AI
A full ChatGPT-style AI assistant built right in. You can:
- Ask questions in temporary (ephemeral) chats or save persistent conversations
- Attach images and PDFs for the AI to read
- Use voice recording to speak your questions
- Choose between fast answers, deep research, web search, image generation, and more — the app automatically picks the best AI model for what you're asking
- Use "Advisor Mode" where the AI asks clarifying questions before answering
- Use "Thinking Mode" to see the AI's step-by-step reasoning
- The AI can search the web in real time via Tavily
- It can generate images via Pollinations AI

### Customizable Dashboard
A bento-grid layout (like Apple's Widgets) where you can arrange resizable widgets:
- Clock, Timer, Calendar
- All Files, Recent Files, Folders
- Tasks, Smart Tasks
- Topic Browser, Tag Index
- Shortcuts, Goals, Routines
- Planner, Today Overview
- Knowledge Search, Header

Drag widgets around, resize them, or stack them. It's fully customizable.

### Organize Everything with Entities
Everything in Flowr is an **entity** — notes, canvases, folders, collections, workspaces, tags, and dividers. They form a tree structure in the sidebar, where you can drag and drop to reorganize. Pin favorites, see recents, and collapse sections.

### Split View & Tabs
Open multiple items in tabs (like a browser). Use split view to see two things side-by-side — for example, a note on the left and a canvas on the right.

---

## How Does It Work Under the Hood?

### Tech Stack

| Layer | What it uses |
|---|---|
| **Framework** | Next.js 16 (React 19) with App Router |
| **Language** | TypeScript (strict mode) |
| **Styling** | Tailwind CSS v4, dark/light theme |
| **State Management** | Zustand (a single big store saved to localStorage) |
| **Database** | Supabase (PostgreSQL, auth, realtime, storage) |
| **Desktop** | Electron 42, electron-builder, auto-updater |
| **AI Providers** | Google Gemini, OpenRouter (many models), Groq, HuggingFace, Cloudflare, Pollinations, SiliconFlow, Tavily |
| **Charts** | Recharts |
| **Drag & Drop** | @dnd-kit and @atlaskit/pragmatic-drag-and-drop |
| **Animations** | Framer Motion, GSAP |
| **Testing** | Vitest (unit tests), Playwright (E2E) |
| **Markdown** | react-markdown + remark-gfm |

### The Architecture in a Nutshell

**A single store drives everything.** All the app's data — notes, canvases, tasks, settings, sidebar state, open tabs — lives in one big Zustand store that syncs to localStorage. When you're online, it also syncs to Supabase. Open the app on another device and your changes appear in real time.

**The AI is powered by a "Chain Router."** When you type a message, the app first classifies what kind of request it is (simple question, complex research, coding, image generation, web search, etc.). Based on that, it picks the best AI model from a chain of fallback models — all configurable from the database. If one model fails, it tries the next one.

**The Canvas has its own geometry engine.** Arrows, curves, splines, corner radii, hit detection — all computed in custom TypeScript code in `lib/geometry/`. When you drag a shape, any arrows attached to it move with it smoothly.

**The Desktop app embeds Next.js.** Instead of running a separate server, the Electron app forks Next.js as a child process. For production, it uses the self-contained `.next/standalone/` output. For development, it connects to the dev server. There's also a local "file vault" — notes and canvases saved as `.md` and `.flowr` files on your hard drive, with a file watcher that picks up changes instantly.

**The Dashboard uses a custom bento-grid engine** (`lib/bento-engine.ts`) with 3 visual columns (6 half-columns internally for precision), gap-filling, swap resolution, and layout recovery — all built from scratch.

### Data Sync Modes

Every entity has a sync mode:
- **Cloud-only** — saved to Supabase, not on disk
- **Local-only** — saved only to your local file vault (desktop only)
- **Full-sync** — saved both in the cloud and on disk

You can toggle between modes freely. When switching from local to cloud, the app warns you about orphaned files.

### Authentication & Access

- Supabase Auth with email/password
- **Beta gating** — only approved users can access the app
- **Admin panel** at `/admin` with user management, AI model config, cost tracking, logs, Telegram bot management, and vault management
- The admin routes are **excluded from the production web build** by physically moving them out of the source tree during build (so regular users can't access them)

### AI Integrations: Telegram Bot

There's also a Telegram bot that runs the same AI routing pipeline. You can chat with the bot on Telegram and it uses the same multi-model chain system.

---

## Project Structure (Key Directories)

```
src/
├── app/              # Pages & API routes (Next.js App Router)
│   ├── admin/        # Admin panel (15 sub-routes)
│   ├── api/          # API routes (AI, auth, search, sync, telegram, etc.)
│   ├── app/          # Main app shell (sidebar, tabs, content area)
│   ├── login/        # Login page
│   └── welcome/      # Onboarding
├── components/       # React components
│   ├── assistant/    # AI chat UI
│   ├── bento/        # Dashboard grid widgets
│   ├── canvas/       # Infinite canvas (blocks, shapes, connections, toolbar)
│   ├── editor/       # Rich text / note editor
│   ├── layout/       # Shell, sidebar, header, tabs, command palette
│   ├── modals/       # All dialog modals
│   ├── tasks/        # Task components
│   ├── tracker/      # Kanban board
│   └── ui/           # Generic UI (button, input, calendar, etc.)
├── data/             # Zustand store (+ types, helpers, tests)
├── hooks/            # Custom React hooks (canvas, drag, voice, etc.)
├── lib/              # Core logic
│   ├── bot/          # AI engine (classifier, chain router, pipeline, providers, tools)
│   ├── canvas/       # Canvas utilities
│   ├── editor/       # Markdown conversion, frontmatter, export
│   ├── geometry/     # Arrow paths, splines, hit testing, bindings
│   ├── bento-engine.ts  # Dashboard layout engine
│   ├── sync.ts       # Supabase sync layer
│   ├── persistence.ts   # Cloud + file persistence
│   └── fileVault.ts  # Local file vault path management
├── middleware.ts      # Auth, beta gating, admin gating
└── globals.css        # Global styles
electron/
├── main.js           # Electron main process (window, IPC, updater)
└── preload.js        # Context bridge
```
