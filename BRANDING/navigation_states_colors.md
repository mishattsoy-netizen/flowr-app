# Navigation States Colors

Standardized colors and behaviors for sidebar navigation buttons (Dashboard, Tracker, Workspaces, etc.).

## States

| State | Background | Foreground | Transition |
| :--- | :--- | :--- | :--- |
| **Regular** | `transparent` | `var(--bone-60)` | `duration-0` (Instant) |
| **Hover** | `var(--bone-6)` | `var(--bone-100)` | `duration-0` (Instant) |
| **Selected** | `var(--bone-15)` | `var(--bone-100)` | `duration-0` (Instant) |
| **Selected + Hover** | `var(--bone-15)` | `var(--bone-100)` | `duration-0` (Instant) |

## CSS Tokens
- **Hover Background**: `rgba(233, 233, 226, 0.06)` (`--bone-6`)
- **Selected Background**: `rgba(233, 233, 226, 0.15)` (`--bone-15`)
- **Regular Foreground**: `rgba(233, 233, 226, 0.60)` (`--bone-60`)
- **Active/Hover Foreground**: `#E9E9E2` (`--bone-100`)

## Logic & Constraints
- **Animation**: All state changes must be instant (`duration-0`). Any transition duration or delay is forbidden for these elements.
- **Hierarchy**: Selected items use a distinct `bone-15` background. To prevent visual "jumping," hovering over a selected item does NOT change its background color.
- **Border Radius**: `var(--radius-small)` (6px).

## Components Using This Spec
- `Sidebar.tsx` (Top-level nav, Collapsed buttons, Section Headers)
- `TreeItem.tsx` (Folders, Files, Workspaces)
- `WorkspaceSwitcher.tsx` (Dropdown items)
