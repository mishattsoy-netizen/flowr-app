# Left Sidebar Specs

**Element Name:** `left_sidebar`

## 1. Description
The main navigation sidebar containing search, primary routes (Dashboard, Tracker), sections (Pinned, Unsorted, Workspaces), and user controls. Designed with a dark panel background, zero-duration transitions for instant responsiveness, and high-density 7-unit (`h-7`) rows.

## 2. Layout & Containers
- **Main Container:** 
  - Classes: `h-full bg-sidebar flex flex-col overflow-hidden flex-shrink-0 w-full`
  - The `bg-sidebar` maps to `--color-panel` in the globals.
- **Top Header (Logo):** 
  - Classes: `flex items-center justify-between px-3 py-3 border-b border-border transition-all duration-0`
- **Main Scroll Area:**
  - Classes: `flex-1 min-h-0 overflow-y-auto scrollbar-thin [scrollbar-gutter:stable] pl-3 pr-[4px] pt-3 mr-[2px]`
- **Footer (Profile/Settings):**
  - Classes: `p-3 border-t border-border flex items-center mt-auto justify-between`

## 3. Elements & Components

### A. Search/Command Button
- **Container:** `flex items-center w-full px-3 py-1.5 bg-[var(--bone-6)] border border-transparent hover:border-[var(--bone-10)] rounded-[var(--radius-8)] group relative cursor-pointer text-left transition-colors`
- **Icon Container:** `w-5 shrink-0 flex items-center justify-center`
  - Icon: `w-4 h-4 text-[var(--bone-60)] group-hover:text-[var(--bone-100)] shrink-0 transition-colors`
- **Label:** `text-[var(--bone-60)] group-hover:text-[var(--bone-100)] w-full text-sm ml-[8px] truncate transition-colors tracking-wide`
- **Keyboard Shortcut Badge (kbd):** `absolute right-2 px-1.5 py-0.5 bg-[var(--bone-10)] rounded-[var(--radius-small)] text-[9px] font-bold text-[var(--bone-60)] tracking-wider`

### B. Primary Navigation Items (e.g., Dashboard, Tracker)
- **Container:** `sidebar-item-row flex items-center w-full cursor-pointer select-none rounded-[var(--radius-8)] px-3 h-7 group border border-transparent transition-all duration-0`
- **Icon Container:** `w-7 shrink-0 flex items-center justify-center`
  - Icon: `w-3.5 h-3.5`
- **Label:** `ml-0 flex-1 text-left text-[14px] tracking-wide`
- **States:**
  - **Active:** `bg-[var(--bone-15)] text-[var(--bone-100)] font-medium tracking-wide`
  - **Default:** `bg-transparent text-[var(--bone-60)] hover:bg-[var(--bone-6)] hover:text-[var(--bone-100)]`

### C. Section Headers (Pinned, Unsorted, Workspaces)
- **Container:** `ml-0 mr-[2px] px-3 py-[3px] (or h-7) flex items-center justify-between group cursor-pointer select-none rounded-[var(--radius-8)] transition-colors duration-0`
- **Label:** `text-[10px] font-ui-label font-medium uppercase tracking-wide`
- **States:**
  - **Context Menu Open:** `!bg-[var(--bone-10)] text-[var(--bone-100)]`
  - **Default:** `text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]`
- **Utility Buttons (Plus, More):** Standard `btn-sidebar-utility` (22x22px).

### D. Tree Items (Folders, Notes, Collections)
- **Container:** `sidebar-item-row group relative flex items-center w-full cursor-pointer select-none transition-all duration-0 px-3 rounded-[var(--radius-8)] h-7 text-[14px]`
  - Padding: dynamically calculated, e.g., `paddingLeft: {depth * 18 + 12}px, paddingRight: 12px`
- **Icon Container:** `w-7 shrink-0 flex items-center justify-center`
  - Icon: `w-3.5 h-3.5 shrink-0`
  - Icon States: `text-[var(--bone-100)]` (Active) vs `text-[var(--bone-60)] group-hover:text-[var(--bone-100)]` (Default)
  - Collapse Indicator (Absolute): `absolute -inset-[4px] flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-[var(--radius-small)] hover:bg-[var(--bone-10)] cursor-pointer`
- **Label:** `ml-0 flex-1 text-left text-fade`
  - States: `text-[var(--bone-100)]` (Active) vs `text-[var(--bone-60)] group-hover:text-[var(--bone-100)]` (Default)
- **Row States:**
  - **Active:** `!bg-[var(--bone-15)] text-[var(--bone-100)] font-medium tracking-wide`
  - **Hover:** `text-[var(--bone-60)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)]`
  - **Multi-Selected:** `bg-[var(--bone-6)] text-[var(--bone-60)] hover:text-[var(--bone-100)]`
- **Utility Action Group (Hover Options):** `flex items-center gap-1 shrink-0 transition-opacity duration-100 opacity-0 group-hover:opacity-100`

### E. Child Indentation Guideline
- A vertical line connects child items to their parent folder.
- **Line:** `absolute top-0 bottom-0 w-[1px] bg-[var(--bone-10)]` (Positioned dynamically using `left: {depth * 18 + 26}px`)

### F. Footer Profile Button
- **Avatar Circle:** `w-8 h-8 rounded-full bg-gradient-to-br from-[var(--bone-15)] to-[var(--bone-6)] border border-[var(--bone-10)] flex items-center justify-center shrink-0 overflow-hidden`
  - Initial Letter: `text-[10px] font-bold text-[var(--bone-60)] tracking-wide`
- **Text Area:** `flex flex-col min-w-0`
  - Username: `text-xs font-semibold text-[var(--bone-100)] truncate tracking-wide`
  - Workspace/Subtitle: `text-[10px] text-[var(--bone-60)] truncate tracking-wide`

## 4. Dividers
- Regular full-width divider: `h-px bg-border/30 -mx-3 mt-[9px] mb-0`
- Collapsed small divider: `w-8 h-px bg-border my-0`

## 5. Key Logic & Constraints
- **Zero Transition:** Most layout and background changes use `transition-all duration-0` to ensure interaction feels perfectly instantaneous.
- **Scroll Fading:** Uses a custom scroll handler to fade out the top/bottom edges (`--scroll-top-offset`, `--scroll-bottom-offset`).
- **Drag & Drop:** While dragging, items use `pointer-events-none` and `opacity: 0` for nested controls.
