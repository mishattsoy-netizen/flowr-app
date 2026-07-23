User request: "dim text when idle"

## 0. Date and time of the request
21.07.2026, 04:28

## 1. User request
User request: "dim text when idle"

## 2. Objective Reconstruction
Make the text of the full-width back button in the "Turn into" submenu dimmed when it is not hovered, and brighten both the icon and text upon hover.

## 3. Strategic Reasoning
The back button recently changed to a full-width row with the text `text-foreground`, which made the text fully bright while the icon was manually set to `opacity-60`. By shifting the opacity classes to the wrapper `<button>`, both the icon and the text will be uniformly dimmed (`opacity-60`) when idle and will smoothly transition to full opacity (`hover:opacity-100`) on hover.

## 4. Detailed Blueprint
- Change the `className` of the `<button>` container to include `text-[var(--bone-100)] opacity-60 hover:opacity-100`.
- Remove the individual text colors and opacities from the inner `ChevronLeft` icon so it inherits from the wrapper.

## 5. Operational Trace
- Used `replace_file_content` to apply `opacity-60 hover:opacity-100` to the back button wrapper in `BlockOptionsMenu.tsx`.

## 6. Status Assessment
Completed. The back button text and icon now neatly dim together when idle, and highlight when hovered.
