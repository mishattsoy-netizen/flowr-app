# 20.06 at 03:55

User request: "on hover show same popup as in chat, but between these 2 sections, 1-link icon and label, 2-copy and open button, add section where i can paste and edit url"

## Objective Reconstruction
The user wants link blocks in the editor/notes page to show a popup on hover (similar to the chatbot's `LinkWithPopup` preview). In the editor's popup, they want a custom middle section containing an input field where the URL can be pasted and edited, in between the header section (favicon and label) and the footer section (copy and open buttons).

## Strategic Reasoning
- We imported `Popover`, `PopoverTrigger`, and `PopoverContent` from the UI directory.
- We added `copied` and `popoverOpen` state hooks as well as mouse event handlers in `BlockRenderer` to trigger the popup on hover.
- In `BlockRenderer.tsx`, the link block rendering was modified:
  - We wrapped the anchor `a` button in a `<Popover>` wrapper.
  - The `<PopoverContent>` displays the 3 requested sections:
    1. Header (Favicon + Label): Displays the resolved favicon and link label content.
    2. Input field: A custom input text box that binds `block.linkUrl` as a default value, saving changes `onBlur` using the store's `onUpdate`.
    3. Action buttons: Horizontal split buttons for Copy (with clipboard write status toggling `COPIED`) and Open (external anchor link).

## Detailed Blueprint
1. Modify imports in [BlockRenderer.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/BlockRenderer.tsx):
   - Import `Check` from `lucide-react`.
   - Import `Popover, PopoverTrigger, PopoverContent` from `@/components/ui/popover`.
2. Add Popover trigger and content nodes under `if (block.type === 'link')`.
3. Style the input box inside Section 2 to match the theme (`bg-[var(--bone-5)]`, border, font-sans).
4. Remove the old side-anchored text input layout.

## Operational Trace
1. Added state variables and hover timer handlers in `BlockRenderer`:
   ```typescript
   const [copied, setCopied] = useState(false);
   const [popoverOpen, setPopoverOpen] = useState(false);
   const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
   const handleLinkMouseEnter = () => { ... };
   const handleLinkMouseLeave = () => { ... };
   ```
2. Replaced the old link layout with the Popover structure:
   ```tsx
   <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
     <PopoverTrigger asChild>
       <a ... onMouseEnter={handleLinkMouseEnter} onMouseLeave={handleLinkMouseLeave}>
         ...
       </a>
     </PopoverTrigger>
     <PopoverContent ... onMouseEnter={handleLinkMouseEnter} onMouseLeave={handleLinkMouseLeave}>
       <div className="flex flex-col gap-2">
         {/* Section 1 */}
         ...
         {/* Section 2 */}
         <input type="text" placeholder="Paste URL here..." ... />
         {/* Section 3 */}
         ...
       </div>
     </PopoverContent>
   </Popover>
   ```

## Status Assessment
- **Completed:** Hover popup implemented on notes link buttons. It includes the favicon/label header, the middle URL text editor input, and bottom copy/open buttons.
- **Fixed:** Cleaned up the separate side-docked URL hover input block, consolidating it inside the unified popover interface.
- **Unresolved:** None.
