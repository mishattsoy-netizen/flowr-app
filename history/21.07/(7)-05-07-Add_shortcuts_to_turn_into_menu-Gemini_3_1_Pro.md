User request: "add simple shortcut to each row on the right side"

## 0. Date and time of the request
21.07.2026, 05:07

## 1. User request
User request: "add simple shortcut to each row on the right side"

## 2. Objective Reconstruction
Add keyboard shortcuts to the "Turn into" submenu items and display them on the right side of each row.

## 3. Strategic Reasoning
The `SlashCommandMenu.tsx` already has shortcut definitions for block types (e.g., `#` for Heading, `-` for Bulleted List). Adding these to the `TurnIntoItem` type in `BlockOptionsMenu.tsx` creates consistency. Rendering them in a clean, small monospace font on the right side of the row enhances discoverability without cluttering the UI. 

## 4. Detailed Blueprint
- Add an optional `shortcut?: string` field to the `TurnIntoItem` interface.
- Populate the `shortcut` property in the `TURN_INTO_ITEMS` array with the same shortcuts used in `SlashCommandMenu.tsx` (e.g., `H1`, `#`, `##`, `T`, `` ` ``, `-`, `--`, `1.`, `[]`, `>`, `---`, `|`).
- Update the item rendering to wrap the right-side elements (shortcut and active checkmark) in a `<div className="ml-auto flex items-center gap-2">`.
- Render the shortcut as `<span className="text-[10px] text-[var(--bone-100)] opacity-40 font-mono tracking-wider">{item.shortcut}</span>`.

## 5. Operational Trace
- Used `replace_file_content` to add the `shortcut` property and update the `TURN_INTO_ITEMS` array in `BlockOptionsMenu.tsx`.
- Used `replace_file_content` to update the render loop to display the shortcut on the right side of the row, next to the checkmark.

## 6. Status Assessment
Completed. Shortcuts are now visible on the right side of the "Turn into" menu items.
