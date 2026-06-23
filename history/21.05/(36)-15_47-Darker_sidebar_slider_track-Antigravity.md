User request: "make bg of this slider darker"

## 0. Date and time of the request
21.05 15:47

## 1. User request
User request: "make bg of this slider darker"

## 2. Objective Reconstruction
The user wants the background track of the navigation slider (Home / Tasks / Chat) in the sidebar to be slightly darker, moving away from a pure white panel background so the interactive pill stands out more clearly.

## 3. Strategic Reasoning
The navigation slider track container was previously styled with `bg-panel` (which evaluates to `#FFFFFF` pure white in light mode). By switching this utility to `bg-[var(--bone-6)]`, a 6% black overlay is applied. Because the sidebar's base background is the new `--sys-color` (`#F7F7F6`), this overlay beautifully composites into a subtle, noticeably darker track for the sliding pill.

## 4. Detailed Blueprint
- `src/components/layout/Sidebar.tsx`: Locate the container div for the Home/Tasks/Chat slider pill. Update its background class from `bg-panel` to `bg-[var(--bone-6)]`.

## 5. Operational Trace
- Executed a file replacement on `src/components/layout/Sidebar.tsx` to modify the sliding pill track's background utility class.

## 6. Status Assessment
The slider background track is now darker, providing better depth and contrast against the `#EFEEEB` slider pill and the surrounding `#F7F7F6` sidebar background.
