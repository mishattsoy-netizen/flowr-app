User request: "delete icons in task attchments" (referencing FIX-overlapping-stroke.md)

### 0. Date and time of the request
July 5, 2026, 16:06 PM (Local Time)

### 1. User request
"delete icons in task attchments" (referencing [FIX-overlapping-stroke.md](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/FIX-overlapping-stroke.md))

### 2. Objective Reconstruction
Fix the overlapping/doubled stroke visual issue on the attachment delete/trash icon (`Trash2`) in the task attachments list within the `TaskInspectorPanel`.

### 3. Strategic Reasoning
- The delete button previously styled the icon using a semi-transparent color variable `text-[var(--bone-30)]`.
- As described in [FIX-overlapping-stroke.md](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/FIX-overlapping-stroke.md), semi-transparent colors (alpha transparency) on SVG paths with high stroke widths cause compositing artifacts where strokes bleed or stack on top of each other.
- Replacing the semi-transparent color with a solid color (`text-[var(--bone-100)]`) and using CSS opacity classes (`opacity-0 group-hover:opacity-30 hover:!opacity-100`) removes these artifacts, keeping the icon's outline sharp and clean.

### 4. Detailed Blueprint
- **Files involved**:
  - [TaskInspectorPanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/tracker/TaskInspectorPanel.tsx)
- **Modifications**:
  - Change the `Trash2` button classes from `text-[var(--bone-30)] group-hover:opacity-100` to `text-[var(--bone-100)] group-hover:opacity-30 hover:!opacity-100`.
  - Add explicit `strokeWidth={2}` on the `<Trash2 />` component.

### 5. Operational Trace
- Edited the attachment list element rendering section in [TaskInspectorPanel.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/tracker/TaskInspectorPanel.tsx).

### 6. Status Assessment
- Successfully corrected the stroke styling of the attachment delete button.
