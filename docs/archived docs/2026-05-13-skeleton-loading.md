# Skeleton Loading System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a premium, shimmer-based skeleton loading system with a 200ms smart delay threshold to prevent layout shift and flickering.

**Architecture:** We will add a global CSS shimmer utility, create a flexible `<Skeleton />` primitive, and use a custom `useDeferredLoading` hook to manage the display timing.

**Tech Stack:** React, Tailwind CSS v4, Lucide React.

---

### Task 1: CSS Foundation (Shimmer Animation)

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Add the shimmer keyframes and container utility**
Add the following to the bottom of `src/app/globals.css`:

```css
/* Shimmer Animation */
@keyframes skeleton-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@utility skeleton-shimmer-container {
  position: relative;
  overflow: hidden;
  background-color: var(--bone-5);
  
  &::after {
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
}
```

**Step 2: Commit**
```bash
git add src/app/globals.css
git commit -m "style: add skeleton shimmer animation and utility"
```

---

### Task 2: Base Skeleton Primitive

**Files:**
- Create: `src/components/ui/Skeleton.tsx`

**Step 1: Implement the Skeleton component**
```tsx
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "skeleton-shimmer-container rounded-md",
        className
      )}
      {...props}
    />
  );
}
```

**Step 2: Commit**
```bash
git add src/components/ui/Skeleton.tsx
git commit -m "feat: add base Skeleton UI primitive"
```

---

### Task 3: Smart Delay Hook

**Files:**
- Create: `src/hooks/use-deferred-loading.ts`

**Step 1: Implement the hook with 200ms threshold**
```ts
import { useState, useEffect } from 'react';

export function useDeferredLoading(isLoading: boolean, delay: number = 200) {
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isLoading) {
      timer = setTimeout(() => {
        setShowSkeleton(true);
      }, delay);
    } else {
      setShowSkeleton(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isLoading, delay]);

  return showSkeleton;
}
```

**Step 2: Commit**
```bash
git add src/hooks/use-deferred-loading.ts
git commit -m "feat: add useDeferredLoading hook for smart skeleton triggering"
```

---

### Task 4: Chat Composition and Integration

**Files:**
- Create: `src/components/assistant/components/ChatSkeleton.tsx`
- Modify: `src/components/assistant/AIAssistant.tsx`

**Step 1: Create the ChatSkeleton composition**
Create `src/components/assistant/components/ChatSkeleton.tsx` with a pulsating avatar and staggered lines.

**Step 2: Integrate into AIAssistant.tsx**
Use `useDeferredLoading` on `isAILoading` to decide when to show the `ChatSkeleton`.

**Step 3: Commit**
```bash
git add src/components/assistant/components/ChatSkeleton.tsx src/components/assistant/AIAssistant.tsx
git commit -m "feat: integrate skeleton loading into AI Assistant"
```

---

### Task 5: File List Integration

**Files:**
- Modify: `src/components/workspace/widgets/AllFilesWidget.tsx`

**Step 1: Add row skeletons to AllFilesWidget**
Use the `Skeleton` component to create 3-5 loading rows while the file list is fetching.

**Step 2: Commit**
```bash
git add src/components/workspace/widgets/AllFilesWidget.tsx
git commit -m "feat: add skeleton loading to AllFilesWidget"
```
