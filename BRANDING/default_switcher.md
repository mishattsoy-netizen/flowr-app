# Spec: Default Switcher

> This is the official pill-shaped tab switcher design for Flowr.

## Visual Properties

- **Container Background**: `bg-background` (hsl(var(--background)))
- **Container Radius**: `8px` (`rounded-[8px]`)
- **Container Padding**: `2px` (`p-0.5`)
- **Active Pill Background**: `var(--bone-10)`
- **Active Pill Radius**: `6px` (`rounded-[6px]`)
- **Active Pill Shadow**: `shadow-sm`
- **Typography**: 
  - Font: `DM Sans` (font-sans)
  - Size: `11px`
  - Weight: `SemiBold` (600)
  - Letter Spacing: `0` (tracking-normal)

## Colors and States

| State | Text Color | Background Color |
| :--- | :--- | :--- |
| **Selected** | `var(--bone-100)` | `var(--bone-10)` (Pill) |
| **Default** | `text-muted-foreground` | Transparent |
| **Hover (Inactive)** | `text-foreground` | Transparent |

## Technical Implementation (React/Tailwind)

```tsx
<div className="relative flex items-center p-0.5 bg-background rounded-[8px] min-w-[160px]">
  {/* Sliding Background Pill */}
  <div 
    className="absolute top-[3px] bottom-[3px] rounded-[6px] bg-[var(--bone-10)] shadow-sm transition-all duration-300 ease-out"
    style={{ 
      left: isActive ? '3px' : 'calc(50% + 1px)', // 3px inset on sides, 2px gap in middle
      width: 'calc(50% - 4px)'
    }}
  />
```
  <button
    className={clsx(
      "relative z-10 flex-1 flex items-center justify-center py-1 rounded-[6px] transition-colors duration-200",
      isActive ? "text-[var(--bone-100)]" : "text-muted-foreground hover:text-foreground"
    )}
  >
    <span className="text-[11px] font-semibold">
      Label
    </span>
  </button>
</div>
```

## Logic and Constraints
- The switcher is designed for 2-3 tabs max.
- The `z-10` on buttons is required to stay above the sliding pill.
- Transitions should be `300ms ease-out` for the pill and `200ms` for text color changes.
