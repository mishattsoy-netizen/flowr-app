User request: "nothing changed, still wrong icons. also add scrolling in the popup and popup should show 10 recent entities"

## 2. Objective Reconstruction
Three issues addressed:
1. Workspace icons in the @ mention popup and mention pills were still showing the wrong icon (box icon instead of the actual user-selected icon like Terminal).
2. Popup should show 10 recent entities instead of 5.
3. Popup should scroll if results overflow.

## 3. Root Cause Analysis
The previous fix was based on an incorrect assumption. The app has **two separate stores** for workspace-related data:
- `state.workspaces` (Workspace[] type) — lightweight records for workspace metadata (name, id, syncMode, etc.). The `icon` field here is often undefined or unreliable.
- `state.entities` (Entity[]) — the actual content tree, which includes entities of `type === 'workspace'` or `type === 'collection'`. These entities have the correct `icon` field (e.g. "Terminal", "Code") used by the sidebar.

The sidebar Workspaces section uses `entities.filter(e => e.type === 'collection' || e.type === 'workspace')` to render workspace items with their icons — which is why it shows correctly. The mention popup was using `state.workspaces` which had no reliable icon field.

## 4. Solution
- **AIAssistant.tsx**: Changed `filteredEntities` to source from `state.entities` only (filtering out divider and tag types). Now `getEntityIconReact(e.type, e.icon)` receives the correct icon name string.
- **ChatInputEditable.tsx**: Updated `allMentionables` in `renderMentionsToHTML` to also use `state.entities` with `e.icon`, removed unused `workspaces` subscription.
- **ChatMessage.tsx**: Updated `getEntityIconReact` to handle `'collection'` type the same as `'workspace'`, and use `iconName` param correctly with Lucide icon lookup.
- **Popup limit**: Increased from 5 to 10, sorted by `lastModified`.
- **Scrolling**: Already existed (`max-h-80 overflow-y-auto`) — confirmed present.

## 5. Status Assessment
Icons should now match the sidebar exactly since we're using the same entity data source with the same icon resolution logic.
