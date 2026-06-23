# 20.06 at 03:59

User request: "when i edit text, on the right add cross and checkmark buttons(cancel or save), when idle show pencil as edit button"

## Objective Reconstruction
The user wants interactive inline editing states inside the link popover:
- When idle (not editing), the popover shows a static read-only label and URL, with a pencil icon button appearing on hover to trigger edit mode.
- When editing, the text turns into an input field, with a checkmark (save) and a cross (cancel/discard) button displayed on the right.

## Strategic Reasoning
- We created separate editing states (`isEditingLabel` and `isEditingUrl`) and local text inputs (`labelInput` and `urlInput`) inside `BlockRenderer`.
- A `useEffect` synchronizes the local inputs with the latest block states from the database whenever the popover opens.
- The UI handles the edit mode transition smoothly:
  - **Idle State:** Displays the title and URL normally. An edit button with the `Pencil` icon appears on hover (`group-hover:opacity-100`). Clicking it changes the corresponding `isEditing` state to `true`.
  - **Edit State:** Renders the styled `<input>` field. On the right, it displays a save (`Check` icon) and cancel (`X` icon) action button. Pressing Enter or clicking Save persists the update. Pressing Escape or clicking Cancel discards the unsaved changes and reverts to the idle state.

## Detailed Blueprint
Modify [BlockRenderer.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/BlockRenderer.tsx):
- Import `Pencil` and `X` from `lucide-react`.
- Add local state trackers `isEditingLabel`, `labelInput`, `isEditingUrl`, `urlInput`, and update hook sync logic.
- Replace popover rendering layout for Section 1 and Section 2 with conditional sub-components reflecting the idle and edit states.

## Operational Trace
1. Added state declarations in `BlockRenderer` and `useEffect` block to reset on popover open:
   ```typescript
   const [isEditingLabel, setIsEditingLabel] = useState(false);
   const [labelInput, setLabelInput] = useState(block.content || '');
   const [isEditingUrl, setIsEditingUrl] = useState(false);
   const [urlInput, setUrlInput] = useState(block.linkUrl || '');
   ```
2. Implemented conditional views inside Section 1 (Label) and Section 2 (URL):
   - Edit mode: input element + save button (`<Check />`) + cancel button (`<X />`).
   - Idle mode: text display + edit button (`<Pencil />`) revealed on hover.

## Status Assessment
- **Completed:** Added fully-featured inline editor popover fields for link label and URL with separate idle and edit states.
- **Fixed:** Integrated checkmark/cross save/cancel handlers and pencil edit triggers inside the Popover layout.
- **Unresolved:** None.
