# Spec: Options Popup & List Items

Standardized styles for context menus, sorting menus, and action popups across the application. This specification officially supersedes and replaces the legacy `popup_glass` spec.

## Component: Popup Container (`popup-glass-small` / `popup-glass-big`)
- **Background**: `var(--color-panel)` (Deep charcoal)
- **Border**: `1px solid var(--bone-12)`
- **Radius**: `var(--radius-regular)` (12px) for small, `var(--radius-big)` (20px) for big
- **Shadow**: `0 4px 12px var(--popup-shadow-color)`
- **Padding**: `p-1` (4px)
- **Gap**: `gap-[2px]` (2px)
- **Transitions**: **None (0ms)** — all hover and selection states must be instant.

## Element: Action Item (`popup-item`)
- **Layout**: `flex items-center gap-3`
- **Typography**: `13.5px`, `var(--bone-70)`
- **Padding**: `px-3 py-[4px]` (compact vertical layout)
- **Border Radius**: `var(--radius-medium)` (8px)
- **Hover State**:
  - **Background**: `var(--bone-6)`
  - **Text**: `var(--bone-100)`
- **Icons**:
  - **Size**: `16px` (centered in 20px optical area)
  - **Color**: Inherits from text (`var(--bone-70)` -> `var(--bone-100)`)

## Element: Danger Item (`popup-item-danger`)
- **Text Color**: `var(--color-danger)`
- **Hover State**:
  - **Background**: `rgba(255, 96, 96, 0.1)` (danger/10)
  - **Text Color**: `var(--color-danger)`

## Element: Group Header / Submenu Trigger
- **Layout**: Includes a chevron icon on the right
- **Icon (Chevron)**: `ChevronRight` at `w-3.5 h-3.5 opacity-70`
- **Selection State**: Active group or selected item shows a checkmark icon on the far right.

## Element: Divider (`popup-divider`)
- **Height**: `1px`
- **Background**: `var(--bone-6)`
- **Margins**: `my-[2px] mx-1.5` (2px vertical margin, 6px horizontal inset)

## Implementation (Tailwind Utilities)
```css
@utility popup-item {
  @apply flex items-center gap-3 w-full px-3 py-1.5 text-[13.5px] cursor-pointer whitespace-nowrap text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--bone-6)] rounded-[var(--radius-medium)] transition-none;
}

@utility popup-item-danger {
  @apply popup-item !text-danger;
  &:hover {
    @apply !bg-danger/10 !text-danger;
  }
}

@utility popup-divider {
  @apply h-px bg-[var(--bone-6)] my-[2px] mx-1.5;
}
```
