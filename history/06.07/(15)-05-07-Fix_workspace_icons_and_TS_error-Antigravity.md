User request: "@[current_problems] fix. also icons still dont match in chat mention pills and actual"

## 2. Objective Reconstruction
Two issues to fix:
1. TypeScript error in `handlers.ts` line 564: parameter 'row' implicitly has 'any' type.
2. Workspace icons in `@mention` pills (inside the contentEditable input) and in the mention popup still show the wrong icon (box icon) instead of matching the actual Lucide icon set by the user (e.g., Terminal, Code, etc.).

## 3. Strategic Reasoning
- **TS error**: Simple fix — add `(row: any)` explicit type annotation.
- **Icon mismatch in pills**: `ChatInputEditable.tsx` uses a raw SVG-string approach for rendering mention pills inside the `contentEditable` div. It was treating `w.icon` as an emoji string and wrapping it in a `<span class="font-emoji">`. But `w.icon` is actually a named Lucide icon key (e.g. `"Terminal"`). Since React components can't be rendered to HTML strings, I built a static `ICON_SVG_PATHS` lookup map that contains the SVG path data for all relevant Lucide icons from `ICON_MAP`, enabling correct SVG rendering.
- **Icon mismatch in popup and message pills**: `getEntityIconReact` in `ChatMessage.tsx` also treated `w.icon` as emoji. Updated it to call `getEntityIcon(workspaceIcon)` which returns the actual LucideIcon component, then renders it if `workspaceIcon.length > 2` (distinguishing icon names from emoji characters).

## 4. Detailed Blueprint
- **handlers.ts**: Add `any` type annotation to `row`.
- **ChatInputEditable.tsx**: Add `ICON_SVG_PATHS` record with SVG path data for common icon names. Update `getEntityIcon` for workspace type to prefer SVG path lookup over emoji rendering.
- **ChatMessage.tsx**: Import `getEntityIcon` from `icons.ts`. Update `getEntityIconReact` to use `getEntityIcon(workspaceIcon)` and render as a React component when `workspaceIcon.length > 2`.

## 5. Operational Trace
- Modified `handlers.ts` line 564 to add explicit `any` type.
- Modified `ChatInputEditable.tsx` to add `ICON_SVG_PATHS` and update workspace icon resolution.
- Modified `ChatMessage.tsx` to import and use `getEntityIcon`, fixing the React-rendered mention pills.

## 6. Status Assessment
TS error resolved. Workspace icons now correctly render matching Lucide icons in both the input mention pills and the popup/message pills.
