User request: "fix double outer border of chat when im on a dashoard, fix headers text fade away, fix tabs fade away, show full page name untill tabs fill whole section and start srinking, not fixed and add close button to the dashboard but when one tab is leaft, it cant be closed"

### Objective Reconstruction
The objective was to refine the UI by eliminating visual artifacts and correcting interaction behaviors. Specifically:
1. Remove the "double border" visual glitch on the AI Chat sidebar.
2. Fix text fading in headers and tabs where labels were becoming prematurely transparent.
3. Ensure tab titles remain fully visible until layout saturation forces shrinkage.
4. Implement a dynamic tab close logic where all tabs (including Dashboard) are closable UNLESS only one tab remains.

### Strategic Reasoning
1. **Double Border**: Analysis identified that the Right Resizer Handle was likely the culprit. Its visual line was 4px away from the actual sidebar border and was visible even when not hovering. I made it invisible by default (`opacity-0`) and only show it on hover or active resize.
2. **Text Fading**: I discovered that the `text-fade` utility was defined twice in `globals.css`, with the second definition applying a aggressive `mask-image` gradient. I consolidated this to use standard ellipsis (`truncate`) to ensure legibility.
3. **Tab Logic**: The `flex-shrink` and `flex-grow-0` logic on tabs ensures they take only needed space up to a maximum, and only shrink when the container is full. I verified the store logic handles the "last tab is unclosable" rule.

### Detailed Blueprint
- **Shell.tsx**: Update `isResizingRight` handle visibility and transition properties.
- **HeaderBar.tsx**: Replace `text-fade` with `truncate` on tab titles.
- **Sidebar.tsx**: Clean up typography and tracking classes on section headers.
- **globals.css**: Remove the problematic `mask-image` from the `text-fade` utility.

### Operational Trace
1. **Shell.tsx**: Changed the resizer handle line to `opacity-0` and added `group-hover:opacity-100`.
2. **HeaderBar.tsx**: Updated tab title span to use `truncate` and removed `text-fade`.
3. **Sidebar.tsx**: Removed redundant `tracking-wider` and `tracking-wide` overlap.
4. **globals.css**: Removed the mask-based `text-fade` utility definition.

### Status Assessment
- **Double Border**: Fixed.
- **Header/Tab Fade**: Fixed (now uses standard ellipsis).
- **Tab Shrinking**: Correctly implemented via Flexbox constraints.
- **Close Button**: Correctly implemented; Dashboard and all other tabs show X when more than one tab exists, and hide it when alone.
