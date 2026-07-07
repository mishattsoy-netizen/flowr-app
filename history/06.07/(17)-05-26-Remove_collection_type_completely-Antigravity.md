User request: "can we remove collections and only keep workspace, i thought we removed them while ago"

## 2. Objective Reconstruction
The objective is to eliminate the legacy `'collection'` entity type entirely from the codebase, merging its usage paths into the standard `'workspace'` entity type. This involves cleanups across all types, store files, drag-and-drop tree logic, context menus, page renderers, and custom modals.

## 3. Strategic Reasoning
- Database query showed that there are currently 0 entities in the database with `type === 'collection'`. This means we can perform a safe clean code removal without needing data migration scripts.
- The UI handled `'collection'` and `'workspace'` identically at the root level of the sidebar. Removing `'collection'` reduces complexity by keeping only one top-level container type (`'workspace'`).
- The modal name `NewCollectionModal` was changed to `NewWorkspaceModal` and its registered modal kind to `newWorkspace` to accurately reflect its role.

## 4. Detailed Blueprint
- **store.types.ts**: Remove `'collection'` from `EntityType` definition. Change modal kind `newCollection` to `newWorkspace`.
- **store.ts**: Remove `'collection'` references from flat hierarchy rules and initial mock data (replaces collections c1/c2 with workspace type).
- **store.helpers.ts**: Remove `'collection'` from workspace root lookup functions.
- **Sidebar.tsx**: Remove `'collection'` filter from workspaces list and DND calculations. Update `openModal` calls.
- **Shell.tsx**: Update modal imports and overlays from `NewCollectionModal` to `NewWorkspaceModal`.
- **NewWorkspaceModal.tsx**: (New file created from NewCollectionModal) handles creating a `'workspace'` type entity.
- **TreeItem.tsx**: Remove `'collection'` checks from type constraints, icons, and nested drop logic.
- **FolderView.tsx**, **PathPicker.tsx**, **AllFilesWidget.tsx**, **FoldersWidget.tsx**, **RecentWidget.tsx**, **TaskInspectorPanel.tsx**, **CommandPalette.tsx**, **EntityPageRenderer.tsx**, **ContextMenu.tsx**, **ChatMessage.tsx**: Clean up checks where `'collection'` was coupled with `'workspace'`.

## 5. Operational Trace
- Deleted legacy files (`NewCollectionModal.tsx`).
- Created and mapped `NewWorkspaceModal.tsx`.
- Updated all type guards in workspace navigation, folder views, and DND zones.
- Verified compilation through `npx tsc --noEmit`.

## 6. Status Assessment
The codebase successfully compiled. Collections are completely removed from the type system and UI layers, leaving Workspaces as the sole top-level container entity.
