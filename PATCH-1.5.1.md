# Flowr Beta v1.5.1 Patch Notes

Welcome to Flowr v1.5.1! This update focuses on workspace decluttering, codebase simplification, and significant performance optimizations. By pruning legacy features and database structures, we are paving a clean runway for the upcoming **Local-First Architecture** and high-fidelity Markdown engine.

---

## 🚀 What's New in v1.5.1

### 🧹 Simplified & Decluttered Workspace
We analyzed user workflows and stripped away bloated, unused elements to make Flowr lighter, faster, and more focused:
*   **Deprecation of "Life Mode"**: Removed legacy life/context tracking systems that overlapped with standard notes.
*   **Simplified Knowledge Categories**: Retired redundant categorizations (*Guides*, *Snippets*, *Resources*) in favor of a clean, unified, and lightning-fast folder-based note system.
*   **Streamlined Editor Blocks**: Removed heavy, experimental *Database* and *Embed* editor block frameworks to optimize notes rendering performance.

### ⚙️ Added Local Cache Controls
If your cloud synchronization ever gets stuck or you want a fresh start, you can now clear your cache directly in the app:
*   **Clear Cache & Reload**: Found under **Settings > Local Cache**, this utility securely resets your local IndexedDB/localStorage vault and immediately reloads fresh state from the cloud.

### 🧠 Streamlined AI Assistant Performance
*   **Cached Application Context**: The AI assistant no longer queries the database for static application identity and creator bios on every single launch. By inlining this static metadata, chat startup latency has been significantly reduced.

### 🔧 Under-the-Hood Improvements
*   **Database Cleanup**: Cleaned up obsolete database schemas, table triggers, and row-level security (RLS) policies in Supabase.
*   **State Optimization**: Removed deprecated state variables and hooks in the Zustand global store to save memory and optimize component re-render loops.

---

## 🛠️ Verification & Quality Checks
*   **TypeScript**: Verified zero compilation errors across all components.
*   **Unit Tests**: Passed all 118 unit tests across the bot pipelines, canvas layout engines, and synchronization modules.
