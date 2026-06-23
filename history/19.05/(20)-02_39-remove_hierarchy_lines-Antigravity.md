User request: "remove hierarchy lines"

## 0. Date and time of the request
Date: 19.05 (May 19, 2026)
Time: 02:39

## 1. User request
"remove hierarchy lines"

## 2. Objective Reconstruction
Remove all vertical tree indentation guide lines (hierarchy lines) inside nested children lists in the sidebar to create a cleaner, flat-yet-indented aesthetic.

## 3. Strategic Reasoning
- **Visual Minimalism**: Indentation by padding alone is highly readable and provides clear visual nesting hierarchy. Removing the thin vertical lines (`w-[1px] bg-[var(--bone-12)]`) reduces unnecessary visual noise and keeps the tree listing extremely clean.

## 4. Detailed Blueprint
- `src/components/layout/TreeItem.tsx`: Remove the `div` element with the hierarchy vertical line style completely from the nested list renderer.

## 5. Operational Trace
- Edited `src/components/layout/TreeItem.tsx`: Removed the absolute positioned vertical line container (`className="absolute top-0 bottom-0 w-[1px] bg-[var(--bone-12)]"`) that was rendered before children mapping.

## 6. Status Assessment
- **Completed**: Indentation guide lines successfully removed from nested tree listings.
