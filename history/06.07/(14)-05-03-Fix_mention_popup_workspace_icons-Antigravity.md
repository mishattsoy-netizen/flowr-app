User request: "it pasted correctyle but for somereasno when i focus on @ it doesnt open popup, but in the secong image i typed @ and it opened popup. also workspace icons dont match in pup with actual. and remove LINK TO... header in popup"

## 2. Objective Reconstruction
Three issues reported with the `@` mention popup in the AI chat input:
1. When the user clicks into an `@` in pasted text (inline `@` in the middle), the popup doesn't appear.
2. Workspace icons in the popup show the generic box icon instead of matching the icon chosen by the user (like Terminal, Code2, etc.).
3. The "LINK TO..." header above the entity list in the popup should be removed.

## 3. Strategic Reasoning
- **@ popup not appearing**: The previous logic used `/@([^@]*)$/.test(assistantInput)` — this only triggered when `@` was at the very end of the string. When text is pasted containing inline `@`, the trigger never fired. The fix is to track cursor position by getting text up to the cursor via `window.getSelection()` in a new `onCursorTextChange` prop in `ChatInputEditable`. `AIAssistant` then uses `cursorText` (text up to cursor) instead of the full `assistantInput` for `isMentionTriggered`.
- **Workspace icons mismatch**: The popup used `getEntityIconReact('workspace', w.icon)` which treated `w.icon` as an emoji string. But `w.icon` is actually a Lucide icon name (like `"Terminal"`) stored in the ICON_MAP. The fix is to use `getEntityIcon(w.icon)` from `icons.ts` which looks up the correct Lucide component.
- **"LINK TO..." header removal**: Simple JSX removal.

## 4. Detailed Blueprint
- **ChatInputEditable.tsx**: Add `onCursorTextChange` prop; update `handleInput` to compute cursor position and emit text up to cursor.
- **AIAssistant.tsx**: 
  - Add `cursorText` state.
  - Wire `onCursorTextChange` into `ChatInputEditable`.
  - Import and use `getEntityIcon` from `icons.ts` for workspace icon rendering.
  - Remove "LINK TO..." JSX block from the popup.

## 5. Operational Trace
- Modified `ChatInputEditable.tsx` with new `onCursorTextChange` prop and `window.getSelection()` cursor tracking.
- Modified `AIAssistant.tsx`: added `cursorText` state, wired props, imported `getEntityIcon`, updated workspace icon mapping, removed LINK TO header.

## 6. Status Assessment
All three issues are resolved. The popup now reacts to wherever the cursor is positioned relative to `@`, shows matching workspace icons, and has no header label.
