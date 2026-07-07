# Plan: Fix Sidebar Empty State & Automate AI Space Context

## 1. Sidebar Empty State Bug
**Cause:** The Tracker's "All Tasks" button sets `activeSpaceId` to `null` to view tasks across all workspaces. Because `activeSpaceId` becomes `null`, the `isEntityVisible` filter in `Sidebar.tsx` evaluates `(e.spaceId || 'ws-personal') === null`, which is always `false`. This hides every item in the sidebar. When the user refreshes the app, `activeSpaceId: null` is rehydrated, leaving the sidebar permanently empty until a space is manually selected.
**Fix:**
- In `Sidebar.tsx`, default to `'ws-personal'` when `activeSpaceId` is `null` for the purpose of filtering sidebar entities and displaying the active workspace name.
- Update `isEntityVisible`: `const effectiveSpaceId = activeSpaceId || 'ws-personal'; return (e.spaceId || 'ws-personal') === effectiveSpaceId ...`
- In `ContextMenu.tsx` spaces menu, highlight "Personal" if `activeSpaceId` is `null`.

## 2. Automate AI Space Context & Fix API Variable Mismatch
**Cause:** 
- I made a huge mistake in the previous plan by suggesting `useStore` in `handlers.ts` (which is server-side) and by conflating App Profiles (`space_id`) with Workspace Entities (`entity_id` or `parent_id`), directly violating `app-structure.md`.
- In addition, there is a bug in `src/app/api/ai/chat/route.ts`: it destructures `activeWorkspaceId` from the request JSON, but the frontend actually sends `activeSpaceId`. This causes `context.activeSpaceId` to be `undefined` when `handlers.ts` tries to use it.

**Fix:**
- **Fix Variable Name:** Update `src/app/api/ai/chat/route.ts` to correctly destructure `activeSpaceId` instead of `activeWorkspaceId`, and pass it into the `context`.
- **Remove AI Space Parameters:** Delete `workspace_id` and `space_id` arguments from all tools in `tools.txt`. The AI should never be asked to specify the Global Space (App Profile).
- **Backend Auto-Assignment:** `handlers.ts` already has `resolveSpaceId(context)` which will now correctly receive the `activeSpaceId` from the frontend. We will ensure that `space_id` is automatically set to this resolved value for all content created by the AI.
- **Preserve Workspace Entity Hierarchy:** The AI will continue to use `assignedWorkspaceId` (for tasks) and `parentId` (for notes/folders) to place items within specific Workspace Entities (Main Folders), respecting the architecture defined in `app-structure.md`.

## 3. Task Panel UI Updates
**Requirement:** Change "Space" in the task panel to "Assignment", and strictly limit it to Workspace Entities only.
**Fix:**
- In `TaskInspectorPanel.tsx`, change the label from "Space" to "Assignment".
- Filter the dropdown options so that it *only* lists entities where `type === 'workspace'` (Main Folders), completely omitting Global Spaces, sub-folders, and notes.

## User Review Required
I have corrected the plan to strictly respect `app-structure.md` and added the Task Panel updates. Please approve so I can proceed!
