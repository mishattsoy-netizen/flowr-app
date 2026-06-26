0. Date and time of the request: 25.06.2026 17:09

1. User request: "dont show this toolbar in tabs header when canvas or mixed pages are open"

2. Objective Reconstruction
- Suppress the save status and desktop actions toolbar in the `HeaderBar` component when a `canvas` or `mixed` page is open.

3. Strategic Reasoning
- Canvas views and mixed dashboard grids have specialized contextual options, and presenting note-specific options (such as the text toolbar button) in the global tabs header creates visual noise and operational redundancy. Restricting this toolbar exclusively to note pages simplifies the workspace presentation.

4. Detailed Blueprint
- **src/components/layout/HeaderBar.tsx**: Exclude `'canvas'` and `'mixed'` page types from `isWorkspaceOrPage` and `isContentPage` checks.

5. Operational Trace
- **HeaderBar.tsx**: Updated `isWorkspaceOrPage` to match `['workspace', 'folder', 'note']` and `isContentPage` to match `['note']`.
- **Typecheck**: Ran `npx tsc --noEmit` cleanly with no errors.

6. Status Assessment
- **Completed**: The header actions toolbar is now hidden for canvas and mixed tabs.
