User request: "chain router must have same style and functions, but without presets"

### Objective Reconstruction
The user wants the router settings within the Planning Assistant config (`RouterSettings.tsx`) to look and function exactly like the main `RouterManager` UI (dark glassmorphic cards, specific icons per category, provider dots, RPD badges, and the rich model dropdown component) but without the Preset management logic and extra toggles.

### Strategic Reasoning
1. **Component Cloning:** Rather than reusing the highly complex `RouterManager` component which has heavy dependencies on global settings (fallback modes, temps, presets), I refactored `RouterSettings.tsx` to replicate its UI precisely.
2. **UI Implementation:** 
   - Restructured the single-column view into a `grid-cols-1 md:grid-cols-2 gap-3` layout.
   - Applied the dark card style (`bg-[#151515] rounded-2xl`).
   - Integrated the `CATEGORY_ICONS` mapping so every category gets its unique `lucide-react` icon.
   - Imported the `ModelDropdown` component to provide the robust search-and-select UI instead of a basic HTML `<select>`.
   - Replicated the `ProviderSelector` component directly within `RouterSettings` to handle the color-coded provider dots.
   - Added the visual RPD (Requests Per Day) badges and the Power/Trash interaction buttons.
3. **Behavioral Logic:** Retained all the previously fixed local state logic (`addModel`, `removeModel`, `toggleModel`, `updateLocalModel`) so the component remains fully functional independently.

### Detailed Blueprint
- `src/components/admin/roadmap/RouterSettings.tsx`:
  - Import `ModelDropdown` and required icons.
  - Implement `ProviderSelector` with `PROVIDER_COLORS` and `PROVIDER_DOTS`.
  - Rewrite the `return` block to map categories into individual styled cards.
  - Link `ModelDropdown` and `ProviderSelector` to the `updateLocalModel` logic.

### Operational Trace
- Replaced the simple list structure in `RouterSettings.tsx` with the cloned `RouterManager` card structure.
- Swapped the native `<select>` element with the rich `<ModelDropdown>`.
- Hooked up `toggleModel` and `removeModel` to the new icon buttons.
- Ensured no Preset, Temperature, or Fallback Mode logic was included.

### Status Assessment
The `RouterSettings` modal now perfectly mirrors the main Router Orchestration dashboard's high-density, dark-themed aesthetic and user experience, fulfilling the request cleanly while keeping dependencies isolated.
