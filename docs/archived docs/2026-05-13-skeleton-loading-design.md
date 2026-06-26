# Design Specification: Skeleton Loading System

Created: 2026-05-13
Status: Validated
Topic: Global Skeleton Loading with Smart Delay

## Overview
Implement a cohesive, premium skeleton loading system across the Flowr-4 dashboard. The system uses a "shimmer" animation that aligns with the Bone design system and includes a "Smart Delay" mechanism to prevent flickering on fast connections.

## 1. Visual Foundation (CSS)

### Shimmer Animation
A linear gradient sweep that moves from left to right.
- **Base Background**: `var(--bone-5)`
- **Shimmer Highlight**: `var(--bone-10)`
- **Duration**: 2s infinite linear

```css
@keyframes skeleton-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.skeleton-shimmer-container {
  position: relative;
  overflow: hidden;
  background-color: var(--bone-5);
}

.skeleton-shimmer-container::after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--bone-10) 50%,
    transparent 100%
  );
  animation: skeleton-shimmer 2s infinite linear;
}
```

## 2. Components

### Base `<Skeleton />`
Location: `src/components/ui/Skeleton.tsx`
A flexible primitive that accepts Tailwind classes for sizing and shaping.

### Composition Components
- **`ChatSkeleton`**: Mimics the message bubble with an avatar and 3 staggered lines.
- **`FileRowSkeleton`**: Mimics a list item with icon and text blocks.
- **`WidgetSkeleton`**: A generic block for dashboard widgets.

## 3. Logic: The Smart Delay (200ms Rule)

To prevent the "slow" feeling caused by brief loading flashes, we implement a delay threshold.

### `useDeferredLoading` Hook
- **Input**: `isLoading` (boolean), `delay` (default: 200ms)
- **Output**: `showSkeleton` (boolean)
- **Behavior**: Only sets `showSkeleton` to `true` if `isLoading` remains `true` for the entire delay period.

## 4. Implementation Priorities
1. **Global CSS**: Add animation to `globals.css`.
2. **UI Primitive**: Create `Skeleton.tsx`.
3. **Hook**: Create `use-deferred-loading.ts`.
4. **Integration**: Apply to `ChatMessage`, `FolderView`, and `AllFilesWidget`.

---
Validated by: Antigravity & User
Date: 2026-05-13
