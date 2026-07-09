User request: "Encountered two children with the same key, `new-workspace`."

## 2. Objective Reconstruction
Resolve the duplicate component key warning `new-workspace` in the `Shell` layout. This was caused by renaming `NewCollectionModal` to `NewWorkspaceModal` while a different `NewWorkspaceModal` already existed and was rendered in the shell overlays.

## 3. Strategic Reasoning
- The old collection creation modal (now renamed to `NewWorkspaceModal`) was adding a sidebar entity (`type: 'workspace'`). The original workspace creation modal (`NewWorkspaceModal`) was creating a workspace record in the store (`createWorkspace`).
- We merged these into a single modal: `NewWorkspaceModal.tsx` now calls both `createWorkspace()` and `addEntity({ type: 'workspace' })` using the exact same ID so they are linked, and switches active state automatically.
- Removed the duplicate render `<NewWorkspaceModal key="new-workspace" />` from the overlays in `Shell.tsx`.

## 4. Detailed Blueprint
- **Shell.tsx**: Remove duplicate render of `NewWorkspaceModal` on line 490.
- **NewWorkspaceModal.tsx**: Combine logic. It now calls `createWorkspace` to register the workspace record, calls `addEntity` to register the matching entity in the sidebar, and sets the active workspace using `setActiveWorkspaceId(id)`.

## 5. Operational Trace
- Edited `Shell.tsx` to remove the extra render line.
- Edited `NewWorkspaceModal.tsx` to combine store mutations.
- Ran `npx tsc --noEmit` to verify typecheck correctness.

## 6. Status Assessment
The compilation was successful and there are no duplicate keys remaining. The new workspace workflow now fully registers both workspace records and entity records in a single step.
