User request: "dont highlight hierarchy lines in the sidebar on hover, dont commit just fix"

### 0. Date and time of the request
Date: 23.06.2026
Time: 23:54

### 1. User request
User request: "dont highlight hierarchy lines in the sidebar on hover, dont commit just fix"

### 2. Objective Reconstruction
Remove hover-activated background color highlights and transitions from the tree layout hierarchy guide lines in the sidebar, while keeping the changes uncommitted in the local repository.

### 3. Strategic Reasoning
- **Guide Line Stability**: By keeping the hierarchy lines statically styled as `bg-[var(--bone-15)]` and removing the `group-hover/treeitem:bg-[var(--bone-30)]` color transition, we prevent guide lines from blinking/animating when items are hovered. This ensures a cleaner, more stable layout context.
- **De-escalation of Transitions**: Removing color transitions on static structural layout elements supports the 0ms instant-response brand guidelines.
- **Strict Compliance**: The code was modified, verified, and left uncommitted/un-staged in Git as explicitly requested by the user.

### 4. Detailed Blueprint
- **[TreeItem.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/layout/TreeItem.tsx)**: Strip `group-hover/treeitem:bg-[var(--bone-30)]` and `transition-colors duration-200` classes from the hierarchy line element.

### 5. Operational Trace
- Replaced the hierarchy line JSX tag in `TreeItem.tsx` to remove hover classes.
- Ran Vitest suite with command: `npx vitest run --exclude "**/.claude/**"`.
- All 118 unit tests passed successfully.
- Left the modifications unstaged in the local Git workspace.

### 6. Status Assessment
- **Completed**: Hover highlights on sidebar guide lines are successfully removed. The dev server is active and hot-reloading. Changes are uncommitted as requested.
