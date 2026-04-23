# Default Small Icon Button

Standardized specification for small, interactive icon buttons used for utility actions (Plus, More, Settings) and expansion controls (Chevrons) throughout the interface.

## Visual Properties

| Property | Value | Rule |
| :--- | :--- | :--- |
| **Idle Background** | `transparent` | |
| **Hover Background** | `var(--bone-10)` | `rgba(233, 233, 226, 0.10)` |
| **Idle Foreground** | `var(--bone-30)` or `var(--bone-60)` | Depends on context (section headers vs tree items) |
| **Hover Foreground** | `var(--bone-100)` | Full contrast on interaction |
| **Border Radius** | `var(--radius-small)` | 6px |
| **Size (Container)** | `24px x 24px` (w-6 h-6) | Standard square container |
| **Size (Icon)** | `14px x 14px` (w-3.5 h-3.5) | Centered within container |

## Implementation Rules
- **Instant Response**: Must use `duration-0` for all color transitions.
- **Stroke Width**: Icons should use `strokeWidth={2}` for consistent visual weight.
- **Alignment**: Icons must be perfectly centered within the 24px container.

## Components Using This Spec
- `Sidebar.tsx` (Section expansion chevrons, New Workspace button)
- `TreeItem.tsx` (Expansion chevrons, Plus button, More options button)
