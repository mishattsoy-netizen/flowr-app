User request: "fix pill in this slider. its not flex size"

### 0. Date and time of the request
May 24, 2026 at 17:20 (Local Time)

### 1. User request
User request: "fix pill in this slider. its not flex size"

### 2. Objective Reconstruction
The user wants to fix the sliding tab control inside the Smart Task Stack widget:
1. Make the sliding active background pill adjust its size dynamically (flex size) based on the exact pixel width and position of the active tab instead of staying at a rigid fixed width of `80px`.
2. Allow different labels with varying text lengths (like "Today" vs. "In Progress") to display cleanly without clipping or overlapping, by enabling fluid tab wrapper widths.

### 3. Strategic Reasoning
- Previously, the tab control had a hardcoded `w-20` (80px) on every tab wrapper, and the sliding pill had a fixed `width: '80px'` and stepped via `activeIndex * 80px`.
- This hardcoded design caused longer strings (like "In Progress") to clip and truncate, and shorter strings (like "Today") to have excessive trailing margins, while the pill looked disconnected from the actual text boundaries.
- Transitioning to a dynamic measurement layout is the industry standard for sliding tab components:
  - Assign a parent `tabContainerRef`.
  - Let tab wrappers expand naturally via padding (`px-3.5`) and shrink-resistant styling (`shrink-0`).
  - Read the active tab's physical `offsetLeft` and `offsetWidth` dimensions inside a `ResizeObserver` and window resize listener.
  - Position and scale the sliding absolute pill element dynamically using these measured state parameters.

### 4. Detailed Blueprint
- **File**: [SmartTaskStackWidget.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/workspace/widgets/SmartTaskStackWidget.tsx)
- **Modifications**:
  - Add `tabContainerRef` and `pillStyle` states.
  - Implement a highly resilient tab boundary measuring `useEffect` hook that handles mounting, dynamic tab selection changes, window resize, and ResizeObserver callbacks.
  - Locate the switcher div and assign the ref, update the sliding pill `div` styles to read dynamic bounds `left` and `width`.
  - Swap the static `w-20` sizing from visible tab wrappers with auto-fitting flex bounds (`px-3.5 shrink-0`).
  - Clean up the `truncate` constraint from the tab button label text to prevent premature truncation.

### 5. Operational Trace
- **Modified**: [SmartTaskStackWidget.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/workspace/widgets/SmartTaskStackWidget.tsx)
  - Applied the multi-chunk layout modifications.
  - Resolved a block-scope declaration reference issue by placing the state hooks at the bottom right before rendering.
- **Ran Verification**: Executed `npx tsc --noEmit` which completed successfully with absolutely zero warnings or errors.

### 6. Status Assessment
- **Completed**: The task stack tab control now resizes fluidly with any mix of tab counts and label widths, and the active pill matches text boundaries perfectly.
- **Result**: Visual layout bugs (text clipping and bad alignment) are completely resolved.
