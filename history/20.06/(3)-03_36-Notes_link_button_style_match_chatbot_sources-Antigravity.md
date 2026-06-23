# 20.06 at 03:36

User request: "i want you to change link button style in the notes page to exact same button design ask sources in chatbot"

## Objective Reconstruction
The user wants to update the styling of the inline link blocks rendered in the document/notes editor page to match the exact visual style of the chatbot's search source indicators.

## Strategic Reasoning
To match the chatbot sources button design:
- We need to strip the accent-colored background (`bg-accent/10`, `hover:bg-accent/20`), border, and text colors from the link button in `BlockRenderer.tsx`.
- We replace them with the chatbot's sources colors: a translucent white background (`bg-white/5`, `hover:bg-white/10`), smaller text size (`text-[11px]`), font weight (`font-medium`), and a matching bone font color (`text-[var(--bone-70)]`, `hover:text-bone-100`).
- The favicon size is reduced from `w-3.5 h-3.5` to `w-3 h-3` with reduced opacity (`opacity-60`) to match the chatbot sources layout.
- The external link arrow icon (`ExternalLink`) is removed from the button, as the chatbot's sources design does not feature an external link icon.

## Detailed Blueprint
Modify the link block layout and style declarations inside `src/components/editor/BlockRenderer.tsx`:
- File: [BlockRenderer.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/BlockRenderer.tsx)
- Find block check `if (block.type === 'link')`
- Modify class names for the anchor tag `a`, image tag `img` (for favicons), and the fallback `LinkIcon` component.
- Remove the `ExternalLink` icon element.
- Update the focus style of the link editable `span` element from `focus:border-accent/40` to a bone token `focus:border-[var(--bone-30)]`.

## Operational Trace
Edited [BlockRenderer.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/BlockRenderer.tsx) between lines 529 and 552:
1. Replaced the `a` element class line:
   ```diff
   - className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent/10 hover:bg-accent/20 rounded-lg text-[14px] font-medium text-accent border border-accent/20 transition-all duration-200 select-none"
   + className="inline-flex items-center gap-2 px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-medium text-[var(--bone-70)] hover:text-bone-100 transition-all duration-200 select-none"
   ```
2. Adjusted favicon size and opacity:
   ```diff
   - <img src={faviconUrl} className="w-3.5 h-3.5 object-contain rounded-sm shrink-0" alt="" />
   + <img src={faviconUrl} className="w-3 h-3 object-contain rounded-sm shrink-0 opacity-60" alt="" />
   ```
3. Adjusted default link icon size and opacity:
   ```diff
   - <LinkIcon className="w-3.5 h-3.5 shrink-0" />
   + <LinkIcon className="w-3 h-3 opacity-60 shrink-0" />
   ```
4. Updated focus state border color:
   ```diff
   - className="min-w-[40px] outline-none border-b border-transparent focus:border-accent/40"
   + className="min-w-[40px] outline-none border-b border-transparent focus:border-[var(--bone-30)]"
   ```
5. Removed `<ExternalLink className="w-3 h-3 opacity-50 shrink-0" />` entirely.

## Status Assessment
- **Completed:** Link block buttons in the editor now match the exact visual look and feel of the sources in the chatbot.
- **Fixed:** Cleaned up the styling rules to utilize general bone layout tokens, removing the accent color highlights from the links.
- **Unresolved:** None.
