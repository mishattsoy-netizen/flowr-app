Date and time of the request: 2026-05-28 21:56

User request: "remove border from avatar and dont change on hover, add bone 6 hover for buttons"

### 2. Objective Reconstruction
The user requested two specific style adjustments in the sidebar footer:
1. Completely remove the visual border from the profile avatar circle (both statically and during active hover states), ensuring it doesn't change border styles on hover.
2. Update the hover background style of the footer action buttons (the Spaces caret button and the Theme Toggle button) to utilize the subtle `var(--bone-6)` background instead of the darker `var(--app-dark)` background.

### 3. Strategic Reasoning
- Removing the border around the avatar creates a much cleaner, border-less, and more premium modern flat look.
- Disabling the hover border transitions on the avatar keeps the avatar visual extremely consistent and quiet when the user hovers over the profile area.
- Applying `hover:bg-[var(--bone-6)]` (and `hover:!bg-[var(--bone-6)]` for the utility class overrides in expanded state) onto both the Spaces caret button and the Theme Toggle button makes their interaction highlight much softer and subtler, blending beautifully within the already highlighted `var(--app-dark)` footer container background.

### 4. Detailed Blueprint
- **File to Modify:** `src/components/layout/Sidebar.tsx`
- **Modifications:**
  - Locate the profile avatar wrapper `div` and remove `border border-[var(--bone-10)]` and `group-hover/profile:border-[var(--bone-20)] transition-colors`.
  - Locate the Spaces caret button and change its hover background classes:
    - Collapsed state: Change `hover:bg-[var(--app-dark)]` to `hover:bg-[var(--bone-6)]`.
    - Expanded state: Change `btn-sidebar-utility` to `btn-sidebar-utility hover:!bg-[var(--bone-6)]`.
  - Locate the Theme Toggle button and change its hover background classes:
    - Collapsed state: Change `hover:bg-[var(--app-dark)]` to `hover:bg-[var(--bone-6)]`.
    - Expanded state: Change `btn-sidebar-utility` to `btn-sidebar-utility hover:!bg-[var(--bone-6)]`.

### 5. Operational Trace
- Used `replace_file_content` to make a targeted edit inside `/Users/mktsoy/Dev/flowr-app/src/components/layout/Sidebar.tsx` for lines 1133 to 1189:
```diff
-            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--bone-15)] to-[var(--bone-6)] border border-[var(--bone-10)] flex items-center justify-center shrink-0 overflow-hidden group-hover/profile:border-[var(--bone-20)] transition-colors">
+            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--bone-15)] to-[var(--bone-6)] flex items-center justify-center shrink-0 overflow-hidden">
               <span className="text-[13px] font-bold text-[var(--bone-70)] tracking-wide group-hover/profile:text-[var(--bone-100)] transition-colors">{sidebarInitial}</span>
             </div>
             {!effectiveCollapsed && (
...
           <Tooltip content="Spaces">
             <button
               onClick={(e) => {
                 e.stopPropagation();
                 const rect = e.currentTarget.getBoundingClientRect();
                 openContextMenu(null, rect.left, rect.top, 'spaces');
               }}
               className={cn(
                 contextMenu?.source === 'spaces' && "!bg-dark !text-[var(--bone-100)] !opacity-100",
                 effectiveCollapsed
-                  ? "w-10 h-10 flex items-center justify-center rounded-[var(--radius-8)] text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] transition-colors border border-transparent"
-                  : "btn-sidebar-utility"
+                  ? "w-10 h-10 flex items-center justify-center rounded-[var(--radius-8)] text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)] transition-colors border border-transparent"
+                  : "btn-sidebar-utility hover:!bg-[var(--bone-6)]"
               )}
             >
               <ChevronsUpDown strokeWidth={2} className="w-4 h-4" />
             </button>
           </Tooltip>
           <Tooltip content="Toggle Theme">
             <button
               onClick={(e) => {
                 e.stopPropagation();
                 toggleTheme();
               }}
               className={effectiveCollapsed
-                ? "w-10 h-10 flex items-center justify-center rounded-[var(--radius-8)] text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] transition-colors border border-transparent"
-                : "btn-sidebar-utility"
+                ? "w-10 h-10 flex items-center justify-center rounded-[var(--radius-8)] text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)] transition-colors border border-transparent"
+                : "btn-sidebar-utility hover:!bg-[var(--bone-6)]"
               }
             >
```

### 6. Status Assessment
- **Completed:** Removed avatar borders cleanly and updated the standalone footer utility buttons on the right side to use a soft `var(--bone-6)` hover background highlight.
- **Unresolved:** None.
- **Next Recommendation:** None.
