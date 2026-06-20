# 20.06 at 03:45

User request: "no i want button to look like this"

## Objective Reconstruction
The user wants the editor's link block button to match the inline `LinkWithPopup` component design from the chatbot (featuring a capsule/pill `rounded-full` shape, a translucent background `bg-[var(--bone-5)]`, and a border `border-[var(--bone-10)]`), as shown in the provided screenshots.

## Strategic Reasoning
We replaced the square button style with the chatbot's inline `LinkWithPopup` capsule styling:
- We matched the layout properties including the rounded wrapper for the favicon (`rounded-[4px]`) and the font properties (`font-bold font-sans text-[var(--bone-70)] hover:text-[var(--bone-100)] no-underline`).
- A border of `border border-[var(--bone-10)]` was added around the capsule button.
- The default `LinkIcon` was wrapped in an overflow-hidden wrapper to match the exact visual boundaries of the favicon when no custom site image is resolved.

## Detailed Blueprint
Modify `src/components/editor/BlockRenderer.tsx`:
- File: [BlockRenderer.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/BlockRenderer.tsx)
- Re-align the styling in `if (block.type === 'link')` block to render the capsule design.

## Operational Trace
Updated [BlockRenderer.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/BlockRenderer.tsx#L529-L551):
1. Changed classes on the anchor `a` element:
   ```diff
   - className="inline-flex items-center gap-2 px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-medium text-[var(--bone-70)] hover:text-bone-100 transition-all duration-200 select-none"
   + className="inline-flex items-center gap-1.5 px-2 py-1 bg-[var(--bone-5)] hover:bg-[var(--bone-10)] rounded-full text-[11px] font-bold font-sans text-[var(--bone-70)] hover:text-[var(--bone-100)] no-underline transition-all duration-200 select-none border border-[var(--bone-10)]"
   ```
2. Wrapped favicon and fallback `LinkIcon` inside their respective wrapper tags to control spacing:
   ```diff
   - {faviconUrl ? (
   -   <img src={faviconUrl} className="w-3 h-3 object-contain rounded-sm shrink-0 opacity-60" alt="" />
   - ) : (
   -   <LinkIcon className="w-3 h-3 opacity-60 shrink-0" />
   - )}
   + {faviconUrl ? (
   +   <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0 overflow-hidden rounded-[4px]">
   +     <img src={faviconUrl} className="w-3 h-3 object-contain select-none opacity-80" alt="" />
   +   </span>
   + ) : (
   +   <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0 overflow-hidden">
   +     <LinkIcon className="w-3 h-3 opacity-60 shrink-0" />
   +   </span>
   + )}
   ```

## Status Assessment
- **Completed:** The editor link button style now perfectly matches the `LinkWithPopup` capsule layout and color values from the chatbot.
- **Fixed:** Aligned visual layout to match the user's screenshots exactly.
- **Unresolved:** None.
