User request: "increase gap between bullet/number and text in notes"

### 0. Date and Time of the Request
- Date: 2026-05-21
- Time: 14:13:19+02:00

### 1. User Request
User request: "increase gap between bullet/number and text in notes"

### 2. Objective Reconstruction
The objective was to increase the visual spacing/gap between the bullet, dash, or number markers and the list text in the Note Editor.

### 3. Strategic Reasoning
- The list block uses a horizontal flex layout (`flex items-start w-full`) where the marker container `div` (`width: 20px`) and the editable text `div` sit side by side.
- Inside the marker container `div`, the content is right-aligned (`justify-end`).
- The gap between the marker and the text was originally controlled by `pr-1` (`padding-right: 4px`) on the marker container `div`.
- Increasing this padding to `pr-2.5` (`10px`) pushes the right-aligned bullet/number marker further to the left, widening the gap between the marker and the text.
- Crucially, because the container width (`width: 20px`) and the start of the main text `div` remain unchanged, the list items retain precise alignment with the checklist checkboxes, maintaining視覺 consistency across all list blocks.

### 4. Detailed Blueprint
- **File to modify**: `src/components/editor/ListBlock.tsx`
- **Changes**:
  - Locate the marker wrapper `div` element inside `RowEl`.
  - Change its Tailwind class `pr-1` to `pr-2.5`.

### 5. Operational Trace
- Read the structural composition of the list elements inside `src/components/editor/ListBlock.tsx`.
- Changed the padding class on line 147 from `pr-1` to `pr-2.5` using the `replace_file_content` tool.
- Verified TypeScript compilation using `npx tsc --noEmit` to ensure the codebase remains clean.

### 6. Status Assessment
- **Completed**: The gap between bullet/number markers and list text is successfully increased to a generous `10px`.
- **Verification**: Clean TypeScript build with no errors.
