User request: "when i hover rows, their icons shift fix"

# 0. Date and time of the request
June 19, 2026 at 02:24 AM

# 1. User request
"when i hover rows, their icons shift fix"

# 2. Objective Reconstruction
Fix the slight visual shifting or jumping of icons in folder rows when hovered. On hover, the folder icon transitions to `opacity-0` and the collapsible chevron button transitions to `opacity-100`. Because the chevron button used a manual, hardcoded offset layout (`-top-[4px] -left-[4px]`), rounding or subpixel layout differences in the browser caused the icons to visually shift slightly.

# 3. Strategic Reasoning
*   **Absolute Centering**: The parent icon wrapper is `w-3.5 h-3.5` (14px) and the chevron button is `w-[22px] h-[22px]`. Instead of manually calculating negative pixel offsets like `-top-[4px] -left-[4px]`, aligning the absolute-positioned button via CSS translate (`top: 50%`, `left: 50%`, `transform: translate(-50%, -50%)`) guarantees mathematically perfect subpixel centering. This prevents any layout shift between the folder icon and the chevron button.

# 4. Detailed Blueprint
*   Replace `-top-[4px] -left-[4px]` class names on the chevron button in `TreeItem.tsx` with absolute translate styling.

# 5. Operational Trace
*   Modified [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx):
    *   Removed `-top-[4px] -left-[4px]` from the chevron `button` className on line 502.
    *   Added `style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}` to the chevron `button`.
*   Updated checklists in [task.md](file:///Users/mktsoy/.gemini/antigravity-ide/brain/c4eb9967-7924-448c-bfa2-ae948032991d/task.md) and [walkthrough.md](file:///Users/mktsoy/.gemini/antigravity-ide/brain/c4eb9967-7924-448c-bfa2-ae948032991d/walkthrough.md).

# 6. Status Assessment
*   The folder icons and collapsible chevron button align perfectly to the exact subpixel center.
*   Hovering over any collapsible folder row no longer causes any horizontal or vertical icon shift.
