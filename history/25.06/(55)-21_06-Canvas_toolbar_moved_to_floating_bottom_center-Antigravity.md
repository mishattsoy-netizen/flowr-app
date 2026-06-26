User request: "toolbar should be floating aswell in the bottm center of canvas, image is reference"

### 0. Date and time of the request
- Date: 2026-06-25
- Time: 21:06 (Local time: 21:06+03:00)

### 1. User request
"toolbar should be floating aswell in the bottm center of canvas, image is reference"

### 2. Objective Reconstruction
Modify the canvas components:
1. Move the center tool buttons group (Select, Pan, Shapes, Content tools) out of the top header bar in [CanvasToolbar.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasToolbar.tsx).
2. Position them as a floating toolbar pill in the bottom center of the canvas viewport, matching the design of the other bottom floating widgets and the user's reference layout.

### 3. Strategic Reasoning
- **Floating Toolbar**: Placing the tool selectors directly at the bottom center of the canvas mirrors the layout of modern design utilities (like Figma or Miro). This clears vertical overhead in the header and places tool selectors right next to the user's workspace.
- **Glassmorphism pill layout**: The floating toolbar is rendered as a clean pill styled with `bg-sidebar/95 backdrop-blur-xl border border-[var(--bone-12)] shadow-md rounded-[10px] p-[4px]` and uses vertical separator dividers to group tools logically (Navigation | Shapes | Content Creation).
- **Click interception**: Handled click bubbling via `stopPropagation()` so interactions with the toolbar don't trigger drag selections or panning behaviors on the canvas viewport behind it.

### 4. Detailed Blueprint
Modify [CanvasToolbar.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasToolbar.tsx):
- Wrap the component's render method in a React Fragment (`<>...</>`).
- Render the top header bar with the canvas title (left) and action buttons (right: layers, snapping, export, share).
- Render the tool selectors as a separate floating pill container positioned at `fixed bottom-6 left-1/2 -translate-x-1/2`.

### 5. Operational Trace
- Modified [CanvasToolbar.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/canvas/CanvasToolbar.tsx):
  - Extracted tool groups (`ToolGroup` for NAV_TOOLS, SHAPE_TOOLS, CONTENT_TOOLS) from the main horizontal flex row.
  - Placed them into a `fixed bottom-6 left-1/2 -translate-x-1/2` wrapper with backdrop blur and border styles.
  - Attached pointer/mouse stopPropagation handlers on the floating toolbar container.

### 6. Status Assessment
- **Completed**: The tools bar has been moved to a floating bottom-center position.
- **Verification**: Dev server compiled and hot-reloaded successfully.
