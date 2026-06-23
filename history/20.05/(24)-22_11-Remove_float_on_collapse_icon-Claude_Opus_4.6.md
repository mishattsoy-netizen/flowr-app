User request: "remove float in collapse icon"

### 0. Date and time of the request
- Date: 20.05
- Time: 22:11

### 1. User request
User request: "remove float in collapse icon"

### 2. Objective Reconstruction
The user noticed that the collapse icon (ChevronDown) on sidebar section headers had a "float in" animation appearance when appearing on hover, and requested to keep only the fade-in and fade-out effects without the float.

### 3. Strategic Reasoning
The "float" appearance was caused by the `transition-all` utility class applied to the ChevronDown component. `transition-all` animated all properties, which could inadvertently include transform properties (like the rotation) during the hover state change, causing a "floating" or spinning-in effect. By changing `transition-all` to `transition-opacity`, the animation strictly applies to the opacity state, leaving only a pure fade in/out effect.

### 4. Detailed Blueprint
- Find all `ChevronDown` icons used as collapse indicators in `Sidebar.tsx`.
- Replace `transition-all` with `transition-opacity` on these icons.
- Ensure `duration-75` is kept for the quick fade effect.

### 5. Operational Trace
- Edited `/Users/mktsoy/Dev/flowr-4-main/src/components/layout/Sidebar.tsx` to update the transition classes on the 4 `ChevronDown` instances in the Pinned, Unsorted, Workspaces, and Chat List section headers.

### 6. Status Assessment
The floating appearance has been removed. The collapse icons now strictly fade in and out when hovered, exactly as requested.
