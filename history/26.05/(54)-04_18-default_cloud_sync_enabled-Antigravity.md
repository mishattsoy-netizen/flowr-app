User request: "by default sync must be on in pages and folders"

### 0. Date and time of the request
May 26, 2026 at 04:18 AM

### 1. User request
User request: "by default sync must be on in pages and folders"

### 2. Objective Reconstruction
Ensure that all newly created pages (Notes, Canvases, Mixed files) and folders have cloud synchronization (`cloudSyncEnabled`) enabled by default so they immediately sync to the cloud storage layer.

### 3. Strategic Reasoning
- **Centralized Defaulting**: Rather than manually adding `cloudSyncEnabled: true` in every single local UI component trigger, updating the core `addEntity` action inside Zustand store (`src/data/store.ts`) is extremely DRY, bulletproof, and ensures the default is applied universally across the entire application workspace context (including new popup creation streams and standard modals).

### 4. Detailed Blueprint
- **store.ts**:
  - Locate the `addEntity` action.
  - In `finalEntity` initialization, set `cloudSyncEnabled: entity.cloudSyncEnabled ?? true`.

### 5. Operational Trace
- **store.ts**:
  - Defaulted `cloudSyncEnabled` to `true` for all newly added entities, triggering direct cloud persistence.

### 6. Status Assessment
- **Completed**:
  - Fully enabled universal default cloud synchronization for all pages, folders, and custom files.
