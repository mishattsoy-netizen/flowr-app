### 0. Date and time of the request
Date: 04.07.2026
Time: 21:34 (Start) - 21:35 (End)

### 1. User request
User request: "yes" (confirming replacement of clipped border/padding styles on workspaces and tags with standard button border rules to align visual heights and margins).

### 2. Objective Reconstruction
- Align the active/hover background highlights of workspaces and tags in the Tasks sidebar with the "All tasks" and "New Task" buttons.
- Replace `border-t border-x border-solid border-transparent bg-clip-padding` with `border border-transparent` to remove background clipping, ensuring highlights fill the full height and width of the rows.

### 3. Strategic Reasoning
- The border-clipping styling from `TreeItem` had a 1px transparent gap inset at the top, left, and right, visually shrinking active backgrounds.
- Replaced this with standard `border border-transparent` so all rows look identical in height, alignment, and background highlights.

### 4. Detailed Blueprint
- `src/components/layout/Sidebar.tsx`: Swap workspaces and tags class lists with `border border-transparent`.

### 5. Operational Trace
- Replaced the classes in `Sidebar.tsx`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. Workspaces, tags, and upper buttons now use identical row padding, borders, and active highlight sizing.
