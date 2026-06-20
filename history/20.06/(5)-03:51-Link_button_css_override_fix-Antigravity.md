# 20.06 at 03:51

User request: "do they look same?"

## Objective Reconstruction
The user pointed out that the link button in the editor still had a rectangular border and underline, and did not match the round capsule layout of the chatbot sources button.

## Strategic Reasoning
- The issue occurred because a general CSS override in `src/app/globals.css` (`.editor-block a`) was targeting all anchor elements inside editor blocks. It was setting a rectangular border-radius (`border-radius: 4px`), custom margins/paddings, and `text-decoration: underline`, overriding the Tailwind utility classes on the link block button.
- To resolve this:
  - We added a unique class `.link-block-btn` to the link button in `BlockRenderer.tsx`.
  - We modified `globals.css` to exclude this class from the general `.editor-block a` styling rule using the CSS `:not()` selector (`.editor-block a:not(.link-block-btn)`).

## Detailed Blueprint
1. Modify [globals.css](file:///Users/mktsoy/Dev/flowr-app/src/app/globals.css) to change `.editor-block a` to `.editor-block a:not(.link-block-btn)` (and similarly for `:hover`).
2. Modify [BlockRenderer.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/BlockRenderer.tsx) to add `link-block-btn` class to the link button anchor tag.

## Operational Trace
1. Edited [globals.css](file:///Users/mktsoy/Dev/flowr-app/src/app/globals.css#L543-L558):
   ```diff
   - .editor-block a {
   + .editor-block a:not(.link-block-btn) {
     ...
   - .editor-block a:hover {
   + .editor-block a:not(.link-block-btn):hover {
     ...
   ```
2. Edited [BlockRenderer.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/BlockRenderer.tsx#L534):
   ```diff
   - className="inline-flex items-center gap-1.5 px-2 py-1 bg-[var(--bone-5)] hover:bg-[var(--bone-10)] rounded-full text-[11px] font-bold font-sans text-[var(--bone-70)] hover:text-[var(--bone-100)] no-underline transition-all duration-200 select-none border border-[var(--bone-10)]"
   + className="link-block-btn inline-flex items-center gap-1.5 px-2 py-1 bg-[var(--bone-5)] hover:bg-[var(--bone-10)] rounded-full text-[11px] font-bold font-sans text-[var(--bone-70)] hover:text-[var(--bone-100)] no-underline transition-all duration-200 select-none border border-[var(--bone-10)]"
   ```

## Status Assessment
- **Completed:** Prevented the global editor anchor overrides from affecting the capsule link block buttons.
- **Fixed:** The editor link button now renders as a capsule (`rounded-full`) with the correct padding, border, and styles to look identical to the chatbot sources.
- **Unresolved:** None.
