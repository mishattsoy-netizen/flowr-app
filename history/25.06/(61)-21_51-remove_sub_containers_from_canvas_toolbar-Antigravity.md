User request: "i dont like this container inside container style, too many layers, just container and buttons"

### 0. Date and time
2026-06-25 at 21:51 (local time)

### 1. User Request
Remove the nested sub-containers around tool groups in the floating canvas toolbar.

### 2. Objective Reconstruction
Flatten the floating canvas toolbar UI by removing the inner background containers (`bg-[var(--bone-5)]`) that wrapped each tool group (Navigation, Shapes, Content), presenting a clean single outer container containing only the buttons and vertical separators.

### 3. Strategic Reasoning
Nested containers created excessive visual layers ("container inside container style"). Removing the wrapper elements and keeping the active button highlights (`bg-[var(--bone-15)]`) simplifies the design, reduces visual clutter, and aligns with modern, clean UI styles.

### 4. Detailed Blueprint
- `CanvasToolbar.tsx`: Replace the `div` wrapper inside `ToolGroup` with a React fragment (`<>...</>`) to render buttons directly inside the outer toolbar container.

### 5. Operational Trace
1. Modified `CanvasToolbar.tsx` line 52 to use `<>` fragment instead of `<div className="flex items-center bg-[var(--bone-5)] rounded-[var(--radius-medium)] p-[3px] gap-[1px]">`.

### 6. Status Assessment
- Inner nested containers removed from the floating toolbar. The toolbar now displays buttons and separators in a single outer container.

*Agent used: `engineering-frontend-developer`*
