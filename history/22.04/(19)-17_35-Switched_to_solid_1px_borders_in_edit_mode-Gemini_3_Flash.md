User request: "use 1 px border when editing"

### 2. Objective Reconstruction
Standardize the "edit mode" visual cues in the Bento dashboard by replacing legacy dashed outlines with clean, solid 1px borders. This includes both the widget indicators and the dragging placeholder.

### 3. Strategic Reasoning
Dashed borders are often used as a quick indicator for "editable" states, but they can feel visually noisy. Transitioning to a solid 1px border using the system's bone tokens (`--bone-15` and `--bone-30`) provides a more refined, professional appearance that maintains the "architectural" feel of the interface while still clearly indicating the active edit state.

### 4. Detailed Blueprint
- **Global CSS**:
    - Updated `.bento-edit-mode .react-grid-item` to use `outline: 1px solid var(--bone-15)`.
    - Updated `.react-grid-item.react-grid-placeholder` to use `border: 1px solid var(--bone-30)` and `bg-bone-5`.
    - Corrected the placeholder's `border-radius` to use the global `var(--radius-big)` token for consistency.

### 5. Operational Trace
- Edited `src/app/globals.css`.
- Switched from `hsl(var(--border))` (which was a legacy variable) to the strictly enforced bone token system.

### 6. Status Assessment
Completed. Edit mode is now cleaner and more consistent with the project's visual identity.
