User request: "make turn into popup same style as search existing entities popup in the brain canvas toolbar"

## 0. Date and time of the request
21.07.2026, 04:11

## 1. User request
User request: "make turn into popup same style as search existing entities popup in the brain canvas toolbar"

## 2. Objective Reconstruction
Restyle the "Turn into" submenu in BlockOptionsMenu to visually match the AddExistingEntityPopover used in the brain canvas toolbar.

## 3. Strategic Reasoning
The AddExistingEntityPopover uses a clean panel design: `rounded-xl bg-panel border border-[var(--bone-10)] shadow-lg`, with a specific search input style and list item pattern. The Turn Into popup was using the older `popup-glass-small` utility with `popup-item` buttons. Replaced the entire submenu render with matching markup.

## 4. Detailed Blueprint
- Replace Turn Into submenu container from `popup-glass-small` to `rounded-xl bg-panel border border-[var(--bone-10)] shadow-lg`
- Replace search input from custom hover/focus styles to match AddExistingEntityPopover's `bg-[var(--bone-6)]` field with clear button
- Replace list items from `popup-item` to `flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] hover:bg-[var(--app-dark)]`
- Add `X` icon import for the clear search button

## 5. Operational Trace
- Viewed AddExistingEntityPopover.tsx to capture the exact styles
- Used `replace_file_content` on BlockOptionsMenu.tsx lines 270-334 to replace the Turn Into submenu
- Added `X` to the lucide-react import

## 6. Status Assessment
Completed. The Turn Into popup now visually matches the Search Existing Entities popup from the brain canvas toolbar.
