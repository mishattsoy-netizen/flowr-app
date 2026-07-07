User request: "fix workspace icon in the mention pill in the message bubbles dont match real ones. Also canvas nas incorect icon aswell in mention popup"

## 0. Date and time of the request
Date: 06.07.2026
Time: 14:42

## 1. User request
User request: "fix workspace icon in the mention pill in the message bubbles dont match real ones. Also canvas nas incorect icon aswell in mention popup"

## 2. Objective Reconstruction
The user wants to fix two issues related to icons in chat mentions: 
1. The workspace icons in the parsed message bubbles (the "pills") do not match the real icons (e.g. showing a Box instead of a User for the Personal workspace).
2. The canvas entities show an incorrect icon in the mention popup menu.

## 3. Strategic Reasoning
- The workspace icon in the message bubble is parsed in `ChatMessage.tsx`. The code previously mapped all entities to `icon: undefined`, including workspace entities stored in the `entities` array. Since the workspace 'Personal' was in `entities`, it matched first, and its `icon` was `undefined`, which defaulted to `<Box />`. The fix was to filter out workspace entities from the general `entities` list mapping and explicitly set the correct icon fallback `(w.type === 'personal' ? 'User' : 'Box')` for workspaces.
- The canvas icon in both `ChatMessage.tsx` and `ChatInputEditable.tsx` was mapped to the `Layout` lucide icon, whereas the rest of the application uses the `Frame` lucide icon. Replacing `Layout` with `Frame` everywhere for 'canvas' type resolves this inconsistency.

## 4. Detailed Blueprint
- **`ChatMessage.tsx`**: Update `parseMentions` to filter `entities` for only `['folder', 'note', 'canvas']` and update the workspace icon fallback to `'Box'`. Update `getEntityIconReact` to return `<Frame>` for canvas instead of `<Layout>`. Update imports to include `Frame` and remove `Layout`.
- **`ChatInputEditable.tsx`**: Update `allMentionables` mapping logic to match the `ChatMessage.tsx` logic exactly. Replace the SVG path for the canvas case in `getEntityIcon` to match the `lucide-frame` SVG.

## 5. Operational Trace
- Replaced `Layout` with `Frame` in `ChatMessage.tsx` and updated `parseMentions` logic.
- Updated imports in `ChatMessage.tsx` to include `Frame`.
- Updated `allMentionables` logic in `ChatInputEditable.tsx`.
- Updated the canvas SVG path in `ChatInputEditable.tsx`.

## 6. Status Assessment
Fixed both the workspace icon fallback in message bubbles and the canvas icon inconsistency in the mention popups and pills. Completed.
