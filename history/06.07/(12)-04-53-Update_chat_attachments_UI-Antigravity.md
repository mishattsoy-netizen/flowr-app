User request: "fix cross button in attchments section is covered. also make attachments a bit bigger and if its a file like txt, pdf or md that has file name, make attachment horizontal, icon on the left, title in the righ with fade out effect if doesnt fit"

## 2. Objective Reconstruction
The user requested UI improvements for the file attachments section inside the AI chat input component. Specifically:
1. Fix the "remove attachment" (cross) button being visually cut off/covered.
2. Increase the default size of the attachment previews.
3. Enhance the layout for text-based and PDF files (which possess filenames) by transforming them into a horizontal "pill" shape with an icon on the left, the title on the right, and a fade-out text truncation effect for long names.

## 3. Strategic Reasoning
- **Cross Button Clipping:** The attachments list container used `overflow-x-auto` combined with absolute positioning (`-top-1.5 -right-1.5`) for the remove button. This inherently clips the button on the top boundary. To fix this without breaking the scrolling layout, the button was moved entirely inside the attachment's bounding box (`top-1 right-1`).
- **Attachment Sizing:** The dimensions for image/standard attachments were increased from `w-11 h-11` to `w-14 h-14` to make them more legible.
- **Horizontal File Pill:** For file types (`file`, `pdf`, `text`), a dynamic class conditionally overrides the square dimensions. It uses `w-auto max-w-[160px] px-3` to create a pill shape. The inner layout flexes the icon and a `<span>` containing the file name.
- **Fade-out Effect:** To implement a smooth fade-out instead of an abrupt ellipsis, an inline `style` with `maskImage` and `WebkitMaskImage` was applied using a linear gradient that transitions to `transparent` at 100%.

## 4. Detailed Blueprint
- **src/components/assistant/AIAssistant.tsx**:
  - Update the `.map()` block inside the attachments container.
  - Apply conditional sizing: `w-14 h-14` for standard, `w-auto max-w-[160px] h-14 px-3` for file types.
  - Implement a dedicated inner `div` structure for files containing the `FileText`/`Paperclip` icon and a styled `span` for the filename.
  - Relocate the remove (`X`) button's CSS classes to anchor it within the bounds (`top-1 right-1`) and enhance its visibility (`bg-red-500/90 hover:bg-red-500 backdrop-blur-sm`).

## 5. Operational Trace
- Replaced the attachments rendering loop in `AIAssistant.tsx` to accommodate the new conditional layouts.
- Verified CSS classes (`overflow-hidden`, `whitespace-nowrap`, `maskImage`) function cohesively.

## 6. Status Assessment
All UI requests for the chat attachments have been implemented successfully. The attachments are larger, files display horizontally with a sleek fade-out, and the remove button is fully accessible.
