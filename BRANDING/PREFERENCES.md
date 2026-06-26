# Design Preferences

> AI-managed living document tracking the user's design philosophy and patterns.

---

## Stylistic Philosophy

- **Overall feel:** Dark, premium, minimalist — glassmorphism-inspired "Bone" aesthetic
- **Color system:** Semantic bone tokens (`--bone-5` through `--bone-100`) with semi-transparent overlays
- **Accent color:** `--accent` maps to `--bone-100` (#E9E9E2) — NOT a vibrant color
- **Interactive states:** `bg-accent/10` + `border-accent/30` pattern for selections/active states
- **Backgrounds:** Prefer `bg-panel/90 backdrop-blur-xl` over solid `bg-panel` for modals/popovers

## Typography

- **Display headings:** Crimson Pro (`font-display`) — used for page titles, greeting headers
- **UI text:** DM Sans (`font-sans`, `font-ui`) — used for labels, body, controls
- **Letter spacing:** Prefer `tracking-normal` (0) for UI labels and switcher tabs. Avoid `tracking-tight` or `tracking-tighter`.
- **UI labels:** DM Sans with `letter-spacing: 0.06em` (`font-ui-label`) — used for small uppercase labels
- **Image Narrative:** Literata (serif) with `leading-[135%]` and `tracking-[0.135em]` for a premium, spacious look.
- **Monospace:** DM Mono (`font-mono`) — used for code, vault values
- **Calendar/pickers:** User explicitly rejects Crimson Pro — use `font-ui` (DM Sans) only
- **Font weights:** Preferred "strong" weight is **SemiBold** (`600`, `font-semibold`). Use **Bold** (`700`) only for large display numbers (clocks, timers). Never use **Extra Bold** (`800`) or **Black** (`900`).

## User Likes

- **Corners:** 8px corners (`var(--radius-medium)`) for blocks in notes
- Semi-transparent glass fills over solid backgrounds
- Square/rounded-rect shapes (`rounded-[4px]`) for calendar date cells
- Borderless selected states (no `border` on selected items)
- **Block Hover Backgrounds:** Block rows in the document editor use `bg-[var(--bone-2)]` (`rgba(0, 0, 0, 0.02)` in light mode, `rgba(233, 233, 226, 0.02)` in dark mode) for hover/focus states, ensuring subtle but visible feedback across both themes.
- **Tab switchers:** Clean, borderless `bg-dark` containers with a rounded active sliding pill (`bg-[var(--bone-10)]`) rather than solid `bg-background` or borders, providing a unified dark aesthetic across widgets.
- **Mono Pills (Quick Access):** Transparent background with a `1px` border of `var(--bone-10)`, `var(--bone-100)` text (idle), and `var(--bone-30)` icon (idle). On hover, it fills with `var(--app-dark)`, removes the border (`border-transparent`), and transitions the icon to `var(--bone-60)` while maintaining `var(--bone-100)` text. Sized compactly (`px-3 py-1.5`, `text-[12px]`) with corners using `rounded-[var(--radius-medium)]` (8px) rather than capsule shapes, maintaining a minimal boxy tone.
- Subtle hover backgrounds (`hover:bg-white/5`) over bordered buttons
- **Canvas Button Hover State:** Floating panels (Layers, Styles) and toolbar buttons in the canvas page use `hover:bg-[var(--app-dark)]` to ensure a consistent, darkened hover state highlight across both light and dark themes.
- Compact, tight spacing
- `font-ui-label` for small uppercase labels (Today, Clear, etc.)
- **Chat message hover footprints:** Wrap right-aligned user messages and their action buttons in a stretched `w-full flex flex-col items-end` container, matching the bot's `w-full` hover detection block. This guarantees stable, stutter-free mouse-down movements to click actions, while keeping all bubble elements perfectly right-aligned.
- **Instant response:** **Universal Mandate (0ms)**. ALL interactive elements, including navigation components, tabs, buttons, context menus, and selection indicators, must have **no transition duration** and no fade-in/out effects. State changes (hover, selection) must be perfectly sharp and immediate. 
  - **Exception**: Dashboard **Widgets** must use a standardized hover transition of exactly `200ms ease-in-out` (`transition-all duration-200 ease-in-out`) to provide fluid and uniform fade in/out animations across all cards.
  - **Exception**: Structural **Collapse/Expand** animations (e.g., Sidebar width, Folder tree expansion, Section accordions) should maintain their smooth transitions (100ms-300ms) to provide spatial continuity.
- **Selection Indicators:** Prefers checkmarks (`Check` icon) on the right side of the label for nested menu options. Indicator should be subtle (`bone-60`) and brighten to `bone-100` on hover.
- **Popup Fills:** Selected items in menus/popups should have a subtle background fill (`bone-6`) rather than just a text color change.
- **Widget Borders:** Prefers ultra-subtle borders for widgets (`border-[var(--bone-3)]`, 3% opacity) to ensure seamless integration into the dashboard.

## User Dislikes

- Full solid white/accent fills (`bg-accent`, `bg-bone-100`)
- Crimson Pro font in utility components (calendar, pickers, forms)
- Heavy borders on selected elements
- Scale transforms on selected items
- Oversized UI elements
- Heavy font weights (Extra Bold, Black, 800+)

## Technical Trends

- Uses Tailwind CSS v4 with `@utility` custom utilities in `globals.css`
- Prefers `clsx` or `cn()` for conditional class merging
- Uses `var(--bone-*)` CSS custom properties for all bone tokens
- Popover components preferred over native `<select>` elements
- `popup-glass-big` / `popup-glass-small` utilities for modal containers
- **Image Generation:** Always use the highest possible resolution supported by the provider/model (e.g., 2048x2048 for Flux on SiliconFlow, 1024x1024 for others). Managed via `getHighestResolution` in `image-utils.ts`.
