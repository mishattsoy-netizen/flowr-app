User request: "when i press new page open popup with options: Note, canvas, mixed. that will be created as new flie in unsorted. it will speedup ux. when i press plus button in the workspace or press new item button open popup but add foler option, folders nad pages are created in the workspace. no modal"

### 0. Date and time of the request
May 26, 2026 at 03:56 AM

### 1. User request
User request: "when i press new page open popup with options: Note, canvas, mixed. that will be created as new flie in unsorted. it will speedup ux. when i press plus button in the workspace or press new item button open popup but add foler option, folders nad pages are created in the workspace. no modal"

### 2. Objective Reconstruction
Implement a sleek, modern popup-based creation flow to replace the legacy heavyweight `NewItemModal` overlay.
- Clicking `+ New Page` in the left sidebar must trigger an instant dropdown option popup with **Note**, **Canvas**, and **Mixed** options. Creating an option will immediately create that item in "Unsorted" (i.e. root workspace with `parentId: null`) and focus it.
- Clicking `+` on list folder/workspace tree items or the `New Item` buttons on workspace/folder headers must trigger a dropdown option popup with **Folder**, **Note**, **Canvas**, and **Mixed** options, creating the item nested in that workspace or folder with zero-duration transitions.

### 3. Strategic Reasoning
- **Premium UX Speedup**: Heavy modal dialogs slow down flow. By implementing floating dropdown menus directly positioned relative to the clicked triggers, we offer instant desktop-class productivity.
- **Strict 0ms Transitions**: We strictly inherit the standard `popup-glass-small` and `popup-item` tokens with `transition-none` to guarantee immediate render speed, adhering to the **Universal Mandate (0ms)**.
- **Dismissal Mechanism**: Full-screen invisible pointer catcher overlays are mounted beneath the popups to handle outside click dismissals reliably.

### 4. Detailed Blueprint
- **Sidebar**:
  - Add state `newPagePopupPos` for coordinates.
  - Modify `+ New Page` button click trigger.
  - Render the popup next to the trigger before Sidebar's closing tag.
- **Workspace Tree Items**:
  - Add state `plusPopupPos` in `TreeItem.tsx`.
  - Modify `handlePlusClick`.
  - Render the options popup at the end of the item node.
- **Workspace/Folder Headers**:
  - Add state `newItemPopupPos` to `WorkspacePage.tsx` and `FolderView.tsx`.
  - Replace the legacy `openModal` trigger on both buttons and render options popups aligned below the headers.

### 5. Operational Trace
- **Sidebar.tsx**:
  - Added `newPagePopupPos` state.
  - Imported `generateId`.
  - Retargeted button click handler to `setNewPagePopupPos({ x: rect.right + 4, y: rect.top })`.
  - Rendered popup with `Note`, `Canvas`, and `Mixed` options using `popup-glass-small` container and `popup-item` rows with `transition-none`.
- **TreeItem.tsx**:
  - Added `plusPopupPos` state.
  - Retargeted `handlePlusClick` to `setPlusPopupPos({ x: rect.right + 4, y: rect.top })`.
  - Rendered popup with `Folder`, `Note`, `Canvas`, and `Mixed` options at `plusPopupPos` coordinates.
- **WorkspacePage.tsx** & **FolderView.tsx**:
  - Added `newItemPopupPos` state in both.
  - Retargeted `New Item` buttons to open popups aligned right below the button trigger.
  - Rendered creation dropdown options inside the current active element folder/workspace scope.

### 6. Status Assessment
- **Completed**:
  - Fully implemented the modal-free popup creation flow across the entire workspace, satisfying the user's requirements perfectly.
- **Next steps**:
  - Keep iterating on any other speed and UX elements!
