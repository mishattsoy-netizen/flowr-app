User request: "fix corner radius and use background color for menu background"

### 2. Objective Reconstruction
Refine the geometry and color of the task widget tab switcher. Transition from a semi-rounded box to a fully rounded "pill" shape and use the deeper application background color for the switcher's track.

### 3. Strategic Reasoning
A fully rounded `rounded-full` shape is more consistent for segmented controls that use a sliding pill. By switching the track background from `bone-5` (a light grey/bone) to `bg-background` (almost black in dark mode), we create a higher contrast environment for the active `bg-accent` (bone/white) pill, making the interface feel more tactile and premium.

### 4. Detailed Blueprint
- **SmartTaskStackWidget**:
    - Changed container class to `rounded-full`.
    - Changed container background to `bg-background`.
    - Changed sliding pill class to `rounded-full`.

### 5. Operational Trace
- Edited `src/components/workspace/widgets/SmartTaskStackWidget.tsx`.

### 6. Status Assessment
Completed. The switcher now has a sleek, high-contrast pill design.
