User request: "dont blur bg just darken a bit"

# History Report: Darken Task Sidebar Backdrop

### 0. Date and Time of the Request
- Date: May 27, 2026
- Completion Time: 12:51 PM

### 1. User Request
User request: "dont blur bg just darken a bit"

### 2. Objective Reconstruction
- Update the backdrop overlay behind the task details sidebar drawer to remove the blur effect (`backdrop-blur-sm`).
- Slightly darken the overlay background from `bg-black/40` to `bg-black/50` to maintain premium focus on the sidebar panel while keeping the background board sharp.

### 3. Strategic Reasoning
- The user requested keeping the background dashboard/board sharp (no blur) but wanted visual focus on the sidebar.
- Switching to `bg-black/50` without `backdrop-blur` provides a highly readable and clean dimming contrast while keeping board details completely visible and sharp.

### 4. Detailed Blueprint
- **`src/components/modals/NewTaskModal.tsx`**: Change `className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm transition-opacity duration-300"` to `className="fixed inset-0 z-[200] bg-black/50 transition-opacity duration-300"`.

### 5. Operational Trace
1. **Modified Overlay Styling**:
   Updated the backdrop wrapper div inside `NewTaskModal.tsx` to remove `backdrop-blur-sm` and set the color overlay to `bg-black/50`.
2. **Type Checking Verification**:
   Ran `npx tsc --noEmit` and confirmed compilation is 100% clean.

### 6. Status Assessment
- **Status**: Completed. The background overlay dims perfectly with no blur, highlighting the task details sidebar elegantly.
