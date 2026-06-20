User request: "shift"

# 0. Date and time of the request
June 19, 2026 at 02:26 AM

# 1. User request
"shift"

# 2. Objective Reconstruction
Completely eliminate transition animation delays on sidebar item hover states (e.g. background changes and icon opacity updates). Mixed transitions over different elements caused layout reflow and subpixel shifting animations in the browser on hover entry and exit.

# 3. Strategic Reasoning
*   **0ms Transition Preference**: The user's branding preference specifies that all state transitions (hover, selections) must be instant (0ms duration, no fade-in/out).
*   **Preventing Jitter**: Removing CSS transitions (`transition-all` on the row wrapper, `transition-opacity` on the icon container, and `transition-opacity` on the folder mainIcon) forces state updates to toggle immediately and synchronously. This prevents the GPU from drawing intermediate subpixel layout adjustments during hover animations, completely resolving the visual shifting.

# 4. Detailed Blueprint
*   Remove `transition-all` from the `rowRef` class list in `TreeItem.tsx`.
*   Remove `transition-opacity duration-200` from the general icon wrapper in `TreeItem.tsx`.
*   Remove `transition-opacity duration-100` from the `mainIcon` wrapper in `TreeItem.tsx`.

# 5. Operational Trace
*   Modified [TreeItem.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/TreeItem.tsx):
    *   Removed `transition-opacity duration-100` from the collapsible folder icon container on line 487.
    *   Removed `transition-all` from the row flex wrapper on line 546.
    *   Removed `transition-opacity duration-200` from the icon flex container on line 561.
*   Updated checklists in [task.md](file:///Users/mktsoy/.gemini/antigravity-ide/brain/c4eb9967-7924-448c-bfa2-ae948032991d/task.md) and [walkthrough.md](file:///Users/mktsoy/.gemini/antigravity-ide/brain/c4eb9967-7924-448c-bfa2-ae948032991d/walkthrough.md).

# 6. Status Assessment
*   Hover states on sidebar rows are now perfectly sharp and immediate (0ms duration).
*   Visual icon shifting on row hover is completely resolved.
