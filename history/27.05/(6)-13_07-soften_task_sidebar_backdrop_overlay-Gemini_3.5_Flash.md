User request: "bg dark overlay is too strong"

# History Report: Soften Task Sidebar Backdrop Overlay

### 0. Date and Time of the Request
- Date: May 27, 2026
- Completion Time: 1:07 PM

### 1. User Request
User request: "bg dark overlay is too strong"

### 2. Objective Reconstruction
- Soften the backdrop overlay behind the task details sidebar drawer by changing the background opacity class from `bg-black/50` to `bg-black/25` to provide a subtle, elegant dimming effect.

### 3. Strategic Reasoning
- The user found the previous dark overlay too heavy, making the rest of the board feel overly dark.
- Switching to `bg-black/25` preserves the focusing effect of the drawer, while keeping the background board visible, clear, and bright.

### 4. Detailed Blueprint
- **`src/components/modals/NewTaskModal.tsx`**: Change backdrop class `bg-black/50` to `bg-black/25`.

### 5. Operational Trace
1. **Adjusted Overlay Opacity**:
   Modified the overlay container styling in `NewTaskModal.tsx` to set background color to `bg-black/25`.
2. **Type Checking Verification**:
   Ran `npx tsc --noEmit` and confirmed compiling is clean.

### 6. Status Assessment
- **Status**: Completed. The background overlay has been softened, offering a very elegant, clean contrast that highlights the drawer beautifully.
