User request: "use 8px and small corners"

### 2. Objective Reconstruction
Adjust the tab switcher geometry from a fully rounded pill to a more defined rectangular shape with 8px corner rounding.

### 3. Strategic Reasoning
While pill shapes are common for segmented controls, 8px corners often align better with architectural UI styles (like Claude or linear-style interfaces). By using 8px for the container and 6px for the inner pill, we maintain a consistent visual gap between the edges, creating a "nested" look that feels intentional and precise.

### 4. Detailed Blueprint
- **SmartTaskStackWidget**:
    - Replaced `rounded-full` with `rounded-[8px]` on the outer track.
    - Replaced `rounded-full` with `rounded-[6px]` on the sliding pill.

### 5. Operational Trace
- Edited `src/components/workspace/widgets/SmartTaskStackWidget.tsx`.

### 6. Status Assessment
Completed. Switcher now uses 8px corners.
