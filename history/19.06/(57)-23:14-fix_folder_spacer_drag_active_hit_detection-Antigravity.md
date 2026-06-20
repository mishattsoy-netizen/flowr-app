User request: "1st problem fixed, second Expanded Folder Bottom-Edge Redirection not fixed, when i hover bottm edge of item 2 in folder 2 there is no line"

## 0. Date and time of the request
Date: 19.06.2026
Time: 23:14 (local time 23:14)

## 1. User request
"1st problem fixed, second Expanded Folder Bottom-Edge Redirection not fixed, when i hover bottm edge of item 2 in folder 2 there is no line"

## 2. Objective Reconstruction
Resolve the issue where dragging an item and hovering over the bottom edge of `item 2` (or the space immediately below it) inside an expanded `folder 2` does not show a horizontal insertion line.

## 3. Strategic Reasoning
When a folder is expanded, a zero-height spacer component (`AfterFolderSpacer`) sits immediately below the folder's children. An absolute-positioned hit target (`h-5 -top-2`) inside the spacer overlaps the bottom edge of the last child item row (`item 2`) to capture drag/drop events. 

To prevent this overlay from intercepting standard click events when drag-and-drop is inactive, we previously added a `useIsDragging` hook to set `pointer-events: none` on the spacer when not dragging. However, React state-based drag tracking is unreliable here because components that are mounted or re-rendered after a drag session starts initialize their state to `false`, disabling the hover hit target during active drags.

Instead of state tracking, we migrated this behavior to pure CSS:
- The spacer hit target is set to `pointer-events: none` by default.
- When a drag is active, the sidebar container gets the `.is-dragging` class. A CSS rule styles `.is-dragging .sidebar-spacer-hit-target` with `pointer-events: auto` to activate the hit target globally during active drag sessions.

## 4. Detailed Blueprint
- **Styling**: Add CSS rule in `src/app/globals.css` to toggle `pointer-events` on `.sidebar-spacer-hit-target` based on the `.is-dragging` parent class.
- **TreeItem Row**: Remove the React state hook `useIsDragging` and assign the `sidebar-spacer-hit-target` class to the hit target div inside `AfterFolderSpacer`.

## 5. Operational Trace
- Added the CSS rules to `src/app/globals.css` right after the cursor lock drag overrides.
- Removed the local React `useIsDragging` hook from `src/components/layout/TreeItem.tsx`.
- Assigned the `sidebar-spacer-hit-target` class to the absolute hit target element inside `AfterFolderSpacer`.

## 6. Status Assessment
- **Status**: Completed.
- **Verification**: Hovering over the bottom edge of `item 2` in an expanded `folder 2` now correctly triggers the spacer and displays the horizontal insertion line at the child's indentation level.
