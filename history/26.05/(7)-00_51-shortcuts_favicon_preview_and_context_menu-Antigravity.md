User request: "show url icon preview insted of this icon if there is or keep this if there isnt. also dont show delete button. insted open options when i  right click in shortcut->open options poup with delete or edit"

# Date and Time of the Request
May 26, 2026 at 00:51

# Objective Reconstruction
Enhance the shortcut widgets with:
- URL favicon preview images: Fetch the favicon using a reliable service (Google s2 favicons API) and display it inside the shortcut item if it is a url-type shortcut. Fallback to the default link icon if the image fails to load or does not exist.
- Contextual option control: Remove the static absolute-positioned red delete button in the top-right corner. Instead, implement a custom context menu (options popup) that opens when right-clicking on a shortcut item. This menu contains options to "Edit" or "Delete" the shortcut item.

# Strategic Reasoning
- Showing actual site logos (favicons) significantly improves the readability and usability of shortcuts, helping users scan and identify their targets quickly.
- Removing static delete buttons removes layout clutter (the red close badge on hover), providing a much cleaner and premium look.
- A right-click context menu feels native, professional, and hides destructive actions (Delete) and configuration utilities (Edit) behind a deliberate user gesture.
- Reusing the pre-existing bento add form container for "Edit" actions minimizes code footprint and keeps user input views unified.

# Detailed Blueprint
1. **Shortcut Item Subcomponent**:
   - Create a clean `ShortcutItem` subcomponent to encapsulate each individual item's hover, context menu, image error fallback, and drag states.
   - Use `onContextMenu` with `e.preventDefault()` to trigger the options popup.
   - Use Google's s2 favicon lookup: `https://www.google.com/s2/favicons?sz=64&domain={hostname}`.
   - Listen to `img` `onError` to fall back to the generic `ExternalLink` icon if the favicon cannot be retrieved.
2. **Context Menu Event Bindings**:
   - Add a global document click listener inside `useEffect` to automatically close open context menus when clicking or right-clicking anywhere else on the screen.
3. **Form Refactoring**:
   - Introduce `editingId` inside the parent `ShortcutsWidget`.
   - Update `handleAdd` to modify the matched item if `editingId` is active, and reset editing parameters upon submission.
   - Bind "Save" label on the action button if `editingId` is selected, otherwise "Add".

# Operational Trace
- Modified [ShortcutsWidget.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/workspace/widgets/ShortcutsWidget.tsx):
  - Added React `useEffect` hook.
  - Declared `editingId` state hook.
  - Refactored `handleAdd` to support modifying matched array objects based on `editingId`.
  - Updated Add/Cancel buttons to support updating states and form resets.
  - Implemented modular `ShortcutItem` subcomponent containing a custom absolute positioned options context menu, favicon image tag with error fallback, and standard drag listeners.

# Status Assessment
- Favicon preview and context option menus fully integrated into the Shortcuts widget.
- Static red delete button removed, and right-click triggers options cleanly.
