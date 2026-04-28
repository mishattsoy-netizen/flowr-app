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
- **Monospace:** DM Mono (`font-mono`) — used for code, vault values
- **Calendar/pickers:** User explicitly rejects Crimson Pro — use `font-ui` (DM Sans) only
- **Font weights:** Preferred "strong" weight is **SemiBold** (`600`, `font-semibold`). Use **Bold** (`700`) only for large display numbers (clocks, timers). Never use **Extra Bold** (`800`) or **Black** (`900`).

## User Likes

- **Corners:** 8px corners (`var(--radius-medium)`) for blocks in notes
- Semi-transparent glass fills over solid backgrounds
- Square/rounded-rect shapes (`rounded-[4px]`) for calendar date cells
- Borderless selected states (no `border` on selected items)
- Subtle hover backgrounds (`hover:bg-white/5`) over bordered buttons
- Compact, tight spacing
- `font-ui-label` for small uppercase labels (Today, Clear, etc.)
- **Sliding transitions:** Specifically for the background "pill" in tab switchers (`transition-all duration-[150ms] ease-out`).
- **Instant response:** Navigation components (sidebar, workspaces, switcher items) must have **no transition delay** (`duration-0`). State changes (hover, selection) should be sharp and immediate. Other UI interactions (hover, button clicks) should also remain sharp.
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
