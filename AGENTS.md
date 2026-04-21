# AGENTS.md - Flowr 4.4.0

## Developer Commands
- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run start`: Start production server
- `npm run lint`: Run ESLint checks

## Architecture Overview
- **Framework**: Next.js 15 (App Router), React 19.
- **State**: Zustand with `persist` middleware (localStorage).
- **Styling**: Tailwind CSS v4 via `@tailwindcss/postcss`.
- **Animations**: GSAP (transitions, modals) and Lenis (smooth scroll).
- **Backend**: Supabase (Optional). Active only if `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set.
- **AI**: Multi-provider (OpenRouter, Gemini, Groq, Ollama) via Next.js edge API routes.

### Directory Structure
- `src/app/`: Routes and Edge API proxies.
- `src/components/`: UI components split by domain (`layout`, `editor`, `canvas`, `assistant`, `dashboard`, `tasks`).
- `src/data/`: Central `store.ts` (Zustand) and `icons.ts` registry.
- `src/lib/`: `supabase.ts` (client) and `sync.ts` (Supabase ↔ Store sync).

## Core Data Models
- **Entity**: Fundamental unit (Collection > Folder > Note/Canvas/Mixed).
- **EditorBlock**: Atomic unit of content for notes and canvases. Supports various types (`text`, `checklist`, `database`, `image`, `shape`, `connection`, etc.).
- **AppTask**: Global or page-linked tasks.
- **AppState**: Managed via Zustand; contains `entities`, `tasks`, `blocks`, and UI state (theme, size, activeEntityId).

## Design System & Conventions
- **Versions**: v1 (rounded, friendly) vs v2 (professional, Claude-inspired).
- **Tokens**: Use Graphite, Panel, White, and Accent colors.
- **Sizing**: Controlled via `data-interface-size` (`small`, `regular`, `big`) on `<html>`.
- **Animations**: Page transitions use GSAP fade + 3px Y slide (200ms).
- **Sidebar**: Complex state matrix (selected, hover on selected, regular hover) matching Figma specs.
- **Buttons**: Strict variants (Regular, Accent, Icon, Menu) with specific border/fill/overlay tokens.

## Versioning & Git Workflow
- **Version Increments**: Increase version by 0.1 on each push (e.g., Flowr-4.1 → Flowr-4.2) unless otherwise specified.
- **Major Versions**: On major releases (e.g., 4.0), archive the previous state in the `@versions` folder.
- **References**: Update all labels and references throughout the codebase when the version changes.
- **Maintenance**: Regularly recommend clearing cache and restarting the server, especially before running the server.

## Supabase Integration
- **Conditional**: If env vars are missing, the app operates in local-only mode (localStorage).
- **Sync**: `src/lib/sync.ts` handles the bidirectional sync of `entities` and `tasks` tables.
