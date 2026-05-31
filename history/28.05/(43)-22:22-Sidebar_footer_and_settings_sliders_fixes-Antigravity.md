User request: "fix settings section in sidebar, sliders in the setting page"

### 0. Date and time of the request
Date: 2026-05-28
Time: 22:22

### 1. User request
"fix settings section in sidebar, sliders in the setting page"

### 2. Objective Reconstruction
1. **Sidebar Settings Section:** 
   - Optimize the profile footer active/hover highlights to ensure a premium, clearly visible visual feedback state when the settings page is active.
   - Fix the profile avatar image rendering fallback logic so that if the user's avatar image fails to load, the initials initials are displayed cleanly instead of rendering a blank gradient circle.
2. **Settings Page Sliders:**
   - Standardize the sliding Appearance and Interface Scaling controls inside the settings page to perfectly match the sleek border-free segmented tab switcher design at the top of the sidebar.
   - Resolve hydration mismatch issues on both settings sliders by using state-based client-mounting checks (`isMounted`).
   - Align the scaling indicators under "Interface Scaling" perfectly with the active selection columns.

### 3. Strategic Reasoning
- **Tactile State Highlights:** Transitioning footer highlights from `bg-[var(--app-dark)]` (which rendered too dark/sunken) to `bg-[var(--bone-6)]` creates a soft, modern visual feedback background in dark mode.
- **Robust Asset Rendering:** Placing the initials `span` directly behind the absolute-positioned `img` layer guarantees that if `sidebarAvatarUrl` is invalid, the `onError` display-none transition instantly exposes the initials fallback, preventing blank circles.
- **Hydration Safe Controls:** Standardizing styling variables during SSR and only mounting the relative sliding pills on the client avoids hydration warning alerts and prevents layout jumps.
- **Perfect Label Columns:** Transitioning scaling labels to `grid grid-cols-3` guarantees mathematical layout symmetry under the Small, Regular, and Big options, correcting the previous `flex justify-between` alignment skew.

### 4. Detailed Blueprint
- **Files Modified:**
  - `src/components/layout/Sidebar.tsx`:
    - Refactor footer hover/active classes to `bg-[var(--bone-6)]`.
    - Stack initials span under absolute-positioned `img` element.
  - `src/components/settings/SettingsPage.tsx`:
    - Introduce `isMounted` mount state.
    - Remove borders and clean slider tracks to match sidebar switch style.
    - Remove `shadow-sm` override on sliding pills.
    - Transform scaling labels to `grid grid-cols-3` with center alignment.

### 5. Operational Trace
- **Modified** `src/components/layout/Sidebar.tsx`:
  - Updated active/hover classes on collapsed and expanded footer cards.
  - Styped avatar image to overlay absolute on top of initials fallback.
- **Modified** `src/components/settings/SettingsPage.tsx`:
  - Added React state `isMounted` with a `useEffect` trigger.
  - Removed container track borders and updated sliding pills to render post-mount without hardcoded box-shadow overrides.
  - Converted the scale labels row to use a 3-column grid layout.
- **Verified** TypeScript compilation checks.

### 6. Status Assessment
- **Completed:** Fully corrected sidebar settings highlighted state, repaired profile avatar fallbacks, standardized and aligned settings page theme and scale sliders to the high-fidelity sidebar segmented control standard.
- **Unresolved:** None.
- **Next Useful Recommendation:** Clear cache and reload the application browser to see the gorgeous live rendering.
