# Spec: Popup Glass (Small & Big)

Core component styles for context menus, sub-popups, and dropdowns.

## Visual Properties (Small)
- **Background**: `var(--color-panel)` (Glassmorphism base)
- **Border**: `1px solid rgba(255, 255, 255, 0.1)` (white/10)
- **Border Radius**: `var(--radius-regular)`
- **Shadow**: `0 4px 12px rgba(0, 0, 0, 0.3)`
- **Container Padding**: `p-1.5` (6px)


## Visual Properties (Big)
- **Background**: `var(--color-panel)`
- **Border**: `1px solid rgba(255, 255, 255, 0.1)`
- **Border Radius**: `var(--radius-big)`
- **Shadow**: `0 8px 24px rgba(0, 0, 0, 0.3)`

## Internal Elements

### Popup Item (`popup-item`)
- **Padding**: `px-3 py-1.5` (standard tight height)
- **Typography**: `13.5px`, `var(--bone-60)` (default), `var(--bone-100)` (hover)
- **Background (Hover)**: `rgba(255, 255, 255, 0.1)` (white/10) - *Instant transition*
- **Background (Selected)**: `var(--bone-6)`
- **Border Radius**: `var(--radius-medium)`
- **Checkmark Indicator**:
    - **Color (Default)**: `var(--bone-60)`
    - **Color (Hover)**: `var(--bone-100)`
    - **Position**: Right side of label

### Popup Divider (`popup-divider`)
- **Height**: `1px`
- **Background**: `rgba(255, 255, 255, 0.05)` (white/5)
- **Margins**: `my-[3px]` (creates 6px visual gap when combined with 3px parent gap)

## Implementation (Tailwind Utilities)
```css
@utility popup-glass-small {
  background-color: var(--color-panel);
  @apply border border-white/10 rounded-[var(--radius-regular)];
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

@utility popup-glass-big {
  background-color: var(--color-panel);
  @apply border border-white/10 rounded-[var(--radius-big)];
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}
```
