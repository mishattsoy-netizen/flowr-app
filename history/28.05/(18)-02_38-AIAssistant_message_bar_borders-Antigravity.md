User request: "for the message bar use same borders as collumns in kanban when idle and change to current border on hover and focus"

### 0. Date and time of the request
- **Date**: 28 May 2026
- **Time**: 02:38 local time

### 1. User request
`User request: "for the message bar use same borders as collumns in kanban when idle and change to current border on hover and focus"`

### 2. Objective Reconstruction
Refactor the unified message input bar container borders in `AIAssistant.tsx` to match the 3% opacity borders utilized on the Kanban columns (`border-[var(--bone-3)]`) when idle, and instantly transition to the original 12% opacity border (`border-[var(--bone-12)]`) on hover and focus/active states (`focus-within`).

### 3. Strategic Reasoning
- **Visual Harmonization**: Aligning the message input bar's idle border with the Kanban board columns (`border-[var(--bone-3)]`) ensures a cohesive, light and premium "Bone" aesthetic across different areas of the dashboard.
- **Micro-Interactions**: Swapping the border to `border-[var(--bone-12)]` on hover and `focus-within` provides a tactile, premium response indicating the input container is active.
- **Instant Response**: Omitted transition duration properties to honor the 0ms instant response preference.

### 4. Detailed Blueprint
- **Files Involved**:
  - `src/components/assistant/AIAssistant.tsx`
- **Classes**:
  - Idle state: `border-[var(--bone-3)]`
  - Hover state: `hover:border-[var(--bone-12)]`
  - Focus state: `focus-within:border-[var(--bone-12)]`

### 5. Operational Trace
- **Code Modification**: Replaced static `border-[var(--bone-12)]` in the `AIAssistant.tsx` container class definition with dynamic border properties: `border-[var(--bone-3)] hover:border-[var(--bone-12)] focus-within:border-[var(--bone-12)]` (applied for both default layout and `chatPageMode`).
- **Fix Import Error**: Resolved a pre-existing type check error in `SupabaseProvider.tsx` where the `Entity` symbol was not imported from the store module, restoring type safety to the workspace.
- **Type Checking**: Validated type safety using `npx tsc --noEmit` which completed with 0 errors.

### 6. Status Assessment
- **Status**: 100% Completed.
- **Next Recommendation**: Hover and focus inside the "Ask Flowr AI" message input bar to feel the snappier visual states in action!
