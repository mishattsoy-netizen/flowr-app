### 0. Date and time of the request
Date: 04.07.2026
Time: 21:43 (Start) - 21:44 (End)

### 1. User request
User request: "yes" (confirming matching of active highlights and layout gaps on the Home tab directory tree as well to preserve UI visual consistency).

### 2. Objective Reconstruction
- Align design styles on the Home tab directory tree (`TreeItem.tsx`) to match the new border and gap metrics:
  - Replace `border-t border-x border-solid border-transparent bg-clip-padding` with standard `border border-transparent` in `TreeItem.tsx`.
  - Add vertical spacing layout gaps (`gap-[1px]`) to the nested children container inside `TreeItem.tsx`.
  - Add layout gaps (`gap-[1px]`) to all main list containers (Pinned, Unsorted, Workspaces) under the Home view in `Sidebar.tsx`.

### 3. Strategic Reasoning
- Keeping the old clipped styles on one tab while utilizing standard highlights on another created a visual mismatch.
- Upgraded the Home tab directory elements to standard border highlighting and added layout gaps, unifying active borders and item margins system-wide.

### 4. Detailed Blueprint
- `src/components/layout/TreeItem.tsx`: Replace border clipping rules and add gap properties to nested folder children lists.
- `src/components/layout/Sidebar.tsx`: Add gap parameters to all main sidebar lists under the Home tab.

### 5. Operational Trace
- Edited the layout properties and classes in `TreeItem.tsx` and `Sidebar.tsx`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. Active highlight sizing, borders, and gaps are now unified between the Home and Tasks tab lists.
