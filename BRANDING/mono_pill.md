# Spec: Mono Pill

> Standardized specification for small, interactive quick access or filter pills with text and an icon. Designed to be compact, borderless on hover, and visually minimal.

## Visual Properties

| Property | Value | Tailwind Classes / CSS |
| :--- | :--- | :--- |
| **Idle Background** | `transparent` | `bg-transparent` |
| **Idle Border** | `1px solid var(--bone-10)` | `border border-[var(--bone-10)]` |
| **Idle Text** | `var(--bone-100)` | `text-[var(--bone-100)]` |
| **Idle Icon** | `var(--bone-100)` @ 30% opacity | `text-[var(--bone-100)] opacity-30` |
| **Hover Background** | `var(--app-dark)` | `hover:bg-[var(--app-dark)]` |
| **Hover Border** | `transparent` | `hover:border-transparent` |
| **Hover Text** | `var(--bone-100)` | `text-[var(--bone-100)]` |
| **Hover Icon** | `var(--bone-100)` @ 60% opacity | `group-hover:opacity-60` |
| **Border Radius** | `var(--radius-medium)` (8px) | `rounded-[var(--radius-medium)]` |
| **Padding** | `6px 12px` | `px-3 py-1.5` |
| **Typography** | Font: DM Sans, Size: 12px, Weight: Medium, Spacing: Tight | `text-[12px] font-medium tracking-tight font-sans` |
| **Icon Size** | `14px x 14px` | `w-3.5 h-3.5` |
| **Icon Stroke Width** | `1.5px` (CSS enforced) | `.mono-pill svg { stroke-width: 1.5px !important }` |
| **Scale Active** | `98%` | `active:scale-[0.98]` |
| **Transitions** | All properties in 200ms | `transition-all duration-200` |

## Design Rules

1. **Mono Pill Colors**: Text is fully bright `var(--bone-100)` when idle. The icon must use the **opaque** `var(--bone-100)` color dimmed via element `opacity` (idle `opacity-30`, hover `opacity-60`) — **never** a translucent `currentColor` like `var(--bone-30)`. Translucent stroke color causes overlapping icon segments to composite twice, producing a "stacked/doubled stroke" seam; element opacity flattens the icon opaquely first, then fades it uniformly. On hover the background fills with `var(--app-dark)` and the icon brightens to `opacity-60`.
2. **Compact Width**: These pills should not have fixed widths; instead, they scale to fit their content while using `shrink-0` to prevent collapsing or wrapping in horizontal flex containers.
3. **No Pill Circles**: The corners must use `rounded-[var(--radius-medium)]` (8px) rather than fully rounded capsule shapes (`rounded-full`), keeping in line with the boxy/minimal aesthetic.
4. **Thinner Stroke Width**: Due to their compact `14px` size, icons inside mono pills must use the `.mono-pill` CSS class to force a crisp `1px` stroke weight and geometric precision rendering, preventing visual line crowding or overlapping/stacked strokes.

## Technical Implementation (React/Tailwind)

```tsx
import { LucideIcon } from 'lucide-react';

interface MonoPillProps {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
}

export function MonoPill({ label, icon: Icon, onClick }: MonoPillProps) {
  return (
    <button
      onClick={onClick}
      className="mono-pill group flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-medium)] bg-transparent border border-[var(--bone-10)] text-[12px] font-medium tracking-tight text-[var(--bone-100)] hover:bg-[var(--app-dark)] hover:border-transparent transition-all duration-200 active:scale-[0.98] shrink-0"
    >
      <span className="shrink-0 text-[var(--bone-100)] opacity-30 group-hover:opacity-60 transition-opacity">
        <Icon strokeWidth={1.5} className="w-3.5 h-3.5" />
      </span>
      <span>{label}</span>
    </button>
  );
}
```

## Components Using This Spec

- `ChatConversation.tsx` (Suggestion pills under welcoming greeting at new chat)
- `BentoDashboard.tsx` (Edit Layout / Done button on dashboard header)
