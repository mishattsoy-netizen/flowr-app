User request: "make all widget sliding animations slower"

### Objective Reconstruction
Increase the duration of all visual transitions and sliding animations within the Bento Dashboard to create a more fluid, deliberate, and premium interaction feel. This applies to widget position changes, placeholder shifts, and divider highlights.

### Strategic Reasoning
Slowing down animations allows the user to better perceive the layout changes and reduces the "jittery" feel of rapid grid rebalancing. By aligning the durations across widgets, placeholders, and dividers, the entire interface feels more cohesive and polished.

### Detailed Blueprint
1.  **BentoDashboard.tsx**:
    *   Increased widget cell transition from `0.3s` to `0.8s`.
    *   Increased placeholder transition from `0.3s` to `0.8s`.
    *   Updated divider interaction transitions from `duration-300` (300ms) to `duration-800` (800ms).
2.  **BentoWidget.tsx**:
    *   Increased internal widget transition from `duration-200` (200ms) to `duration-500` (500ms).

### Operational Trace
- Modified transition strings in `BentoDashboard.tsx`.
- Updated Tailwind duration classes in `BentoDashboard.tsx` and `BentoWidget.tsx`.

### Status Assessment
All sliding and interaction animations are now significantly slower and more graceful.
