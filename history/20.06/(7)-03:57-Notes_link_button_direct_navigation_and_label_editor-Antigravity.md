# 20.06 at 03:57

User request: "i should be able to edil laben only on popup, on button click open link only"

## Objective Reconstruction
The user wants to separate the editing and navigation triggers for the link button:
- Clicking the link button in the editor should directly open the URL in a new browser tab.
- Editing the link's label should only be possible inside the hover popover popup.

## Strategic Reasoning
- Previously, the label text on the main link button was `contentEditable`, causing click events on the text to trigger focus/edit state instead of navigation.
- To implement the new behavior:
  1. We disabled `contentEditable` on the editor's link button label `span` and removed its focus styles, converting it to standard display-only text.
  2. We overrode the trigger's `onClick` handler to intercept Radix UI click propagation and call `window.open` directly.
  3. We made the label editable inside the popover by replacing the static text header in Section 1 with a text `<input>` field. When blurred (`onBlur`) or when Enter is pressed, it calls the database/store update function `onUpdate` to persist the new label.

## Detailed Blueprint
Modify [BlockRenderer.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/BlockRenderer.tsx):
- Remove `contentEditable` and its event hooks from the main button label `span`.
- Update the main anchor `onClick` to call `window.open`.
- Replaced the static header name in `PopoverContent` Section 1 with an `<input>` text box for the link name/label.

## Operational Trace
Edited [BlockRenderer.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/BlockRenderer.tsx#L546-L596):
1. Changed `onClick` of the main anchor `a`:
   ```diff
   - onClick={(e) => { if (!block.linkUrl) e.preventDefault(); }}
   + onClick={(e) => {
   +   e.preventDefault();
   +   e.stopPropagation();
   +   if (block.linkUrl) {
   +     window.open(block.linkUrl, '_blank', 'noopener,noreferrer');
   +   }
   + }}
   ```
2. Changed the label `span` inside the button:
   ```diff
   - <span
   -   contentEditable
   -   suppressContentEditableWarning
   -   onBlur={(e) => onUpdate(block.id, { content: e.currentTarget.textContent || '' })}
   -   onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
   -   className="min-w-[40px] outline-none border-b border-transparent focus:border-[var(--bone-30)] font-medium"
   -   onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
   - >
   -   {block.content || 'Link Label'}
   - </span>
   + <span className="min-w-[40px] font-medium truncate max-w-[120px]">
   +   {block.content || 'Link Label'}
   + </span>
   ```
3. Replaced static text with an input field in the Popover header:
   ```diff
   - <span className="text-[11px] font-bold text-[var(--bone-100)] truncate max-w-[200px]">
   -   {block.content || 'Link Label'}
   - </span>
   + <input
   +   type="text"
   +   placeholder="Link Label"
   +   className="bg-transparent border-none outline-none text-[11px] font-bold text-[var(--bone-100)] w-[180px] p-0 focus:border-b focus:border-[var(--bone-30)] focus:pb-[2px] font-sans"
   +   defaultValue={block.content || ''}
   +   onBlur={(e) => onUpdate(block.id, { content: e.target.value })}
   +   onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
   + />
   ```

## Status Assessment
- **Completed:** Separate editing and navigation triggers implemented. Clicking the link button opens the URL directly, and editing the label is managed inside the hover popup.
- **Fixed:** Avoided accidental edit triggers on clicking links.
- **Unresolved:** None.
