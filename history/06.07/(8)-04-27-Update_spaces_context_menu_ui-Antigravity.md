User request: "i dont see delete button, cahnge selected state to dark bg, and remove checkmarks, add delete buton on the right on hover"

## 2. Objective Reconstruction
The user noticed that the Spaces list in the sidebar (which is powered by the `ContextMenu` component) didn't match their expectations:
1. The currently selected Space showed an orange checkmark and a transparent background.
2. The trash button I previously added wasn't visible (because I added it to `WorkspaceSwitcher` instead of `ContextMenu`, which is the actual dropdown being opened from the Sidebar's `+` section).
The goal is to update the ContextMenu to support these specific styling needs for Spaces.

## 3. Strategic Reasoning
- The Spaces dropdown from the Sidebar is rendered using `ContextMenu.tsx` with the `isSpacesMenu` flag.
- The `ContextMenu`'s `MenuItemComponent` already had a `selected` prop, but it was just applying `bg-[var(--app-dark)]` and rendering a `Check` icon on the right side. Wait, actually the icon on the left was being passed manually for Spaces.
- I needed to extend the `MenuItem` interface to support an arbitrary React node on the right side (`rightElement`) and a way to hide the right-side checkmark (`hideCheckmark`).

## 4. Detailed Blueprint
- **Extend Interface**: Add `hideCheckmark?: boolean` and `rightElement?: React.ReactNode` to `MenuItem` in `src/components/layout/ContextMenu.tsx`.
- **Render Element**: Update `MenuItemComponent` to render `{item.rightElement}` and respect `!item.hideCheckmark` before rendering the default `Check`.
- **Style Selected State**: Add `text-[var(--bone-100)]` to the selected item class so it fully highlights instead of just getting a dark background.
- **Update Spaces Menu**: Modify the `isSpacesMenu` array map to use `selected: ws.id === activeWorkspaceId`, pass `hideCheckmark: true`, completely remove the left `icon`, and provide the `Trash2` button inside `rightElement`.

## 5. Operational Trace
- Edited `src/components/layout/ContextMenu.tsx` to update the `MenuItem` interface.
- Edited `MenuItemComponent` to render the new props and update the active background styling.
- Edited the `isSpacesMenu` generator to construct the items correctly, hooking up the trash icon to `openModal({ kind: 'deleteSpaceConfirm' })`.

## 6. Status Assessment
The Context Menu for Spaces has been successfully updated. It no longer shows checkmarks on the left or right. The active Space is highlighted with a dark background and bright text. Hovering over any Space reveals the delete (Trash) icon on the far right, which successfully triggers the delete confirmation modal.
