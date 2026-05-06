User request: "use small corners for these buttons", "use 8px corners for these buttons", "remove borders, i dont like borders on all buttons"

### 1. Objective Reconstruction
Refine the administrative UI by standardizing all button and input corner radii to 8px (`rounded-medium`) and subsequently removing visible borders from all buttons, tags, and interactive containers to achieve a clean, borderless "glassmorphism" aesthetic.

### 2. Strategic Reasoning
The user requested a specific corner radius (8px) for buttons, which was first applied. Later, the user expressed a preference for a borderless UI. Removing borders while maintaining interactive affordance requires using subtle background shifts (like `bg-white/5` or `bg-accent/10`) to define boundaries without the visual noise of solid lines. This creates a higher-density, more modern look typical of premium dashboard designs.

### 3. Detailed Blueprint
- Update `ModelDropdown.tsx` trigger button to `rounded-medium` and remove `border`.
- Global sweep of `ModelsTable.tsx` to change all `rounded-[5px]` to `rounded-medium` and remove all button/input borders.
- Update `RouterManager.tsx` to remove borders from fallback toggles, temperature inputs, and node action buttons (Power/Trash).
- Remove borders from `AIAssistant.tsx` footer buttons and status badges.
- Update `LogsTable.tsx` status tags and conversation preview blocks to be borderless.
- Replace dashed placeholder borders in `AddCategoryButton.tsx` with subtle background fills.

### 4. Operational Trace
- **ModelDropdown.tsx**: Updated trigger button to `rounded-medium` and removed `border border-white/5`.
- **ModelsTable.tsx**: 
    - Replaced all `rounded-[5px]` with `rounded-medium`.
    - Removed `border` classes from Edit, Delete, and Favorite buttons.
    - Removed borders from `select` and `input` fields in editable rows, replacing with `bg-white/5`.
    - Removed borders from preset management controls.
- **RouterManager.tsx**: 
    - Removed borders from "Keys/Models" toggle and "Temp" container.
    - Removed borders from Power and Trash buttons on each model node.
    - Switched background colors from `bg-background` to `bg-white/5` for better borderless contrast.
- **AIAssistant.tsx**: Removed borders from "Agent" button and "Flowr AI" badge.
- **LogsTable.tsx**: Removed borders from `USAGE_TYPE_CONFIG` tags and message preview blocks.
- **AddCategoryButton.tsx**: Replaced dashed border with `bg-white/[0.02]`.

### 5. Status Assessment
- **Completed**: UI refined with 8px corners and borderless styling across all primary administrative and assistant components.
- **Result**: A consistent, high-density, modern interface that prioritizes content and usability over visible framing.
