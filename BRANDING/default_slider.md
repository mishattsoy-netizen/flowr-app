# Default Slider

## Overview
A continuous sliding pill navigation element used in the main sidebar. It relies on a track container with 2px padding, sharp corners (8px outer, 6px inner), and a sliding active indicator pill with absolute positioning and transition effects.

## Visual Properties
- **Container Padding**: `p-[2px]`
- **Container Radius**: `rounded-[8px]` (8px)
- **Container Background**: `bg-[var(--slider-track)]`
- **Pill Radius**: `rounded-[6px]` (6px, mathematically perfect for 8px outer - 2px padding)
- **Pill Offset Top/Bottom**: `top-[2px] bottom-[2px]`
- **Pill Offset Left**: `calc(2px + ...)`
- **Pill Width Offset**: `calc((100% - 4px) / [number_of_tabs])`
- **Active Pill Background**: `bg-[var(--slider-pill)]`
- **Background/Inactive Pill Background**: `bg-[var(--bone-6)]`
- **Active Pill Shadow**: `var(--slider-pill-shadow)`
- **Transition**: `transition-all duration-300 ease-out`

## Technical Framework (React/Tailwind)

### Track Container
```tsx
<div className="relative flex items-center p-[2px] rounded-[8px] no-drag w-full" style={{ background: 'var(--slider-track)' }}>
```

### Active Sliding Pill
```tsx
<div
  className="absolute top-[2px] bottom-[2px] rounded-[6px] bg-[var(--slider-pill)] transition-all duration-300 ease-out"
  style={{
    width: 'calc((100% - 4px) / 3)',
    left: `calc(2px + (${activeTabIndex} * (100% - 4px) / 3))`,
    boxShadow: 'var(--slider-pill-shadow)'
  }}
/>
```

### Wide Background Container (for neighbors in split-view)
```tsx
<div
  className="absolute top-[2px] bottom-[2px] rounded-[6px] bg-[var(--bone-6)] transition-all duration-300 ease-out"
  style={{
    width: 'calc((100% - 4px) * 2 / 3)',
    left: `calc(2px + (${startingTabIndex} * (100% - 4px) / 3))`,
  }}
/>
```

### Individual Background Pills
```tsx
<div
  key={`bg-${tabIndex}`}
  className="absolute top-[2px] bottom-[2px] rounded-[6px] bg-[var(--bone-6)] transition-all duration-300 ease-out"
  style={{
    width: 'calc((100% - 4px) / 3)',
    left: `calc(2px + (${tabIndex} * (100% - 4px) / 3))`,
  }}
/>
```

## Logic & Constraints
- The `left` positioning relies on a fixed 2px starting base, plus the percentage of the remaining width minus the 4px horizontal padding (2px left + 2px right).
- The `width` of a pill is exactly the track's full width minus 4px total horizontal padding, divided by the number of sections.
- The `duration-300 ease-out` gives it a smooth snap feeling when moving between items.
