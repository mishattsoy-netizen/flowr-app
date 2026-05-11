User request: "this is how it looks" (referring to Image 3 needing final polish to match Image 1)

### Objective Reconstruction
Perform high-precision visual refinements to the `NewTaskModal` to achieve pixel-perfect alignment with the target design (Image 1), including background warmth, integrated top bar, and cleaner date-picking controls.

### Strategic Reasoning
Analyzing the difference between my previous implementation (Image 3) and the goal (Image 1) revealed that the background was too starkly black and the `DatePickerTime` component was cluttered by internal labels. I adjusted the background to a warmer, more premium `#121211` hex and implemented a `hideLabels` prop in the `DatePickerTime` component to allow for a cleaner inline look in the modal. I also integrated the decorative top bar as an absolute-positioned overlay to prevent layout shifts and ensure a seamless blend.

### Detailed Blueprint
- **Colors**: Changed modal background to `#121211/98` and adjusted frame colors to `--bone-2`.
- **Header**: Integrated the top color bar as an absolute overlay with a subtle white edge line.
- **Controls**:
    - Updated `DatePickerTime.tsx` to support a `hideLabels` boolean prop.
    - Simplified the `DatePickerTime` layout in the modal by hiding "Date" and "Time" internal headers.
- **Visuals**:
    - Re-added the solid circle icon for "Category Color".
    - Increased corner radius to `20px` for a softer, more modern look.
    - Refined all shadows and backdrop blurs (`backdrop-blur-3xl`).

### Operational Trace
1.  **Modified `src/components/modals/NewTaskModal.tsx`**: Applied the refined background, top bar, and spacing. Corrected the syntax error.
2.  **Modified `src/components/ui/date-time-picker.tsx`**: Added `hideLabels` prop and logic to suppress internal headers.

### Status Assessment
- **Completed**: The modal now features the warm, premium "Bone" aesthetic with minimalist controls as requested.
- **Verified**: All structural elements (header, description box, subtasks, rows, and footer) now match Image 1.
