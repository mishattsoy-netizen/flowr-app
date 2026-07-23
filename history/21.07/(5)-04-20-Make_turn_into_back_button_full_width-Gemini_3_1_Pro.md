User request: "make this back button fill width"

## 0. Date and time of the request
21.07.2026, 04:20

## 1. User request
User request: "make this back button fill width"

## 2. Objective Reconstruction
Change the back button in the "Turn into" submenu from a small icon-only button to a full-width clickable header button.

## 3. Strategic Reasoning
The previous implementation used a small icon button next to the "Turn into" text. Making the entire header row a clickable button (with `w-full`, hover styles, and `text-left`) provides a much larger hit area and a better UX, matching the behavior users expect in nested dropdown menus.

## 4. Detailed Blueprint
- Convert the `<div className="flex items-center ...">` header containing the `<button>` and text into a single `<button>` element.
- Apply `w-full`, `hover:bg-[var(--bone-6)]`, and appropriate padding to make it a full-width interactive row.
- Move the `onClick` handler to the outer button.

## 5. Operational Trace
- Used `replace_file_content` to replace lines 276-285 in `BlockOptionsMenu.tsx` with the new full-width button implementation.

## 6. Status Assessment
Completed. The back button is now full-width, making it much easier to click while maintaining the updated visual style.
