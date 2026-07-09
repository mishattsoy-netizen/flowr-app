# Flowr: Pre-Final Architecture Design Document

This document serves as the absolute source of truth for the Flowr application's architectural foundation. It is designed to be handed off to other developers or AI sessions to ensure 100% alignment on the MVP's technical direction.

## 1. Application Framework & Environment
* **Platform:** Compiled Desktop App (Electron). 
* **Deprecation:** The PWA (Progressive Web App) architecture is officially abandoned. We are focusing entirely on a true native desktop experience to maximize performance, storage reliability, and local file system access.
* **Tech Stack:** Electron (Node.js runtime) + React + Supabase (Cloud backend).

## 2. Local Source of Truth (Database Engine)
* **Engine:** Local **SQLite**.
* **Security (The Open Ecosystem):** The local SQLite database will remain **unencrypted** at rest. 
* **Rationale:** By leaving the local SQLite database accessible, we allow the 0.1% of power users (using tools like Claude Code or Python scripts) to tinker, build workflows, and evangelize the app. The 99.9% of mass-market users will pay for the convenience of Flowr's built-in AI, securing monetization without alienating hackers who build community.

## 3. Data Structure Model
* **Type:** **Block-Based Structure** (Notion-style), rather than Document-Based (Obsidian-style).
* **Granularity (MVP):** **Coarse (JSON Blob).** To launch as fast as possible, each note/canvas is a single row in SQLite, and its internal blocks are stored as a JSON blob. We sacrifice block-level syncing for immense development speed.
* **Rationale:** A block-based structure allows extreme scalability. Starting with coarse granularity lets us ship the MVP in days instead of weeks, while keeping the door open to migrate to true per-block rows in v2 for granular AI embeddings.

## 4. Sync Engine Architecture
* **Methodology:** **Row-Level Last-Write-Wins (LWW).**
* **Push Trigger (Debounce):** Local SQLite writes happen instantly. A debounced background process pushes the changed row to Supabase 1.5 seconds after the user stops typing.
* **Pull Trigger (Realtime):** The app uses **Supabase Realtime subscriptions** to listen for `postgres_changes`. Edits from the web app or other devices are pulled and merged instantly.
* **Mechanism:** We are dropping any fragile "file-system watching" or "duplicate conflicted copy" logic. When a Realtime event arrives, the engine compares the local timestamp with the remote `updated_at` timestamp. The newer timestamp always overwrites the older one.
* **Known MVP Tradeoff (Whole-Row LWW):** Because we are using coarse granularity (JSON blobs), conflicts resolve at the note level. If a user edits the same note offline on two devices, the newest edit silently overwrites the entire note. This is acceptable for MVP speed, given our explicit anti-CRDT stance.
* **Result:** No more entities multiplying 6x in the sidebar. Fast, native-feeling typing with instant, quiet background syncing.

## 5. Storage Limits & Supabase Scaling
* **Free Tier (Local Only):** Unlimited storage. All attachments, canvases, and notes live strictly on the user's hard drive inside the local SQLite DB.
* **Pro / Max Tier (Cloud Sync):** 
  * Storage caps will be enforced dynamically. As Flowr generates subscription revenue, the backend Supabase infrastructure will be upgraded (e.g., to the $25/mo Pro plan) to support higher storage limits per user.
  * For the MVP (on Supabase Free Tier), reasonable maximums (e.g., 5MB per canvas/attachment) will be enforced to prevent abuse. These will scale up as the backend scales.

## 6. The Downgrade Protocol (Pro -> Free)
* **Trigger:** When a user's subscription expires, their account tier reverts to `free`.
* **Action 1 (Instant Lock):** Cloud syncing is immediately disabled. The desktop app reverts to `local-only` mode. Whatever data is currently on the local machine remains intact.
* **Action 2 (Cloud Grace Period):** The user's cloud data enters a 30-day "Read-Only" state. 
* **Action 3 (Purge):** After 30 days of no renewal, the cloud data is purged to save server costs. The desktop app will show a persistent warning banner during this grace period to incentivize renewal.

## 7. MVP Migration Strategy
* **Decision:** **One-Shot Importer (Lightweight).**
* **Rationale:** Because we chose the 'Coarse' data model (JSON blobs), migrating existing users is actually very easy. On the first launch of the new version, the app will read the old `localStorage`/file-vault data, map it directly into the new SQLite rows, and save it. This protects your early beta testers' data without requiring a complex, backwards-compatible sync engine.

---

### Handoff Instructions for Future AI/Dev Sessions:
* **DO NOT** attempt to build web-based IndexedDB storage. Assume Electron/SQLite.
* **DO NOT** build complex CRDT merging algorithms. Assume Last-Write-Wins.
* **DO NOT** attempt to sync raw Markdown files via OS file watchers. Sync SQLite rows to Supabase rows.

### Rationale for other AI Sessions: Why SQLite over File System?
If you are an AI reading this, you might be tempted to build a pure markdown file-system architecture (like Obsidian) because it is popular. **Do not do this.** We explicitly chose SQLite over a raw file system for the following reasons:
1. **Cloud-Sync Reliability:** We must bridge seamlessly with a cloud backend (Supabase). Syncing raw text files and watching for OS-level file changes is notoriously brittle, prone to race conditions, and creates annoying "conflicting copies." Syncing structured database rows (blocks) via Last-Write-Wins is vastly more stable.
2. **Block-based Scalability:** A file system forces a rigid document-based architecture. We need a block-based architecture (like Notion) where every paragraph, heading, and canvas element is an independent entity. This enables granular syncing, dynamic custom widgets, and granular AI embeddings per block.
3. **Open Ecosystem & Community:** We offer premium AI features, but we intentionally keep the local SQLite database unencrypted. Power users can use third-party CLI scripts to bypass our subscription and generate content. We *want* this. Let hackers hack—they build community and tutorials. The mass market will pay for our seamless, built-in AI UI.
