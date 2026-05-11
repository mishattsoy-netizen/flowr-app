User request: "hideLabels is not defined"

### Objective Reconstruction
Fix a `ReferenceError` in `DatePickerTime.tsx` caused by missing destructuring of the newly added `hideLabels` prop.

### Strategic Reasoning
When I added the `hideLabels` functionality to the `DatePickerTime` component in the previous step, I correctly updated the TypeScript interface but forgot to actually destructure the prop from the function arguments. This resulted in the variable being used in the JSX without being defined in the scope. I performed a surgical fix to include the prop in the destructuring assignment.

### Detailed Blueprint
- **File**: `src/components/ui/date-time-picker.tsx`
- **Action**: Add `hideLabels` to the props destructuring list in the `DatePickerTime` function.

### Operational Trace
1.  **Modified `src/components/ui/date-time-picker.tsx`**: Added `hideLabels` to the destructuring of the first argument.

### Status Assessment
- **Resolved**: The `ReferenceError` is cleared and the component now correctly handles the `hideLabels` prop for a minimalist display.
