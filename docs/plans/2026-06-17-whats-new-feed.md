# What's New Feed Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a clean, minimalistic "What's New / Updates" feed page/tab in settings to show patch versions, titles, and itemized lists of what has been added, fixed, changed, or improved.

**Architecture:** 
- A static, schema-validated TypeScript data file (`src/data/patches.ts`) storing the array of patch cards.
- A central component (`src/components/settings/UpdatesSection.tsx`) rendering a scrollable list of card components with subtle entrance animations, version badges, dates, and categorized changes.
- Integration into `SettingsModal` and `SettingsPage` tabs.

**Tech Stack:** React, Next.js, Tailwind CSS, Lucide Icons.

---

## Proposed Changes

### 1. Data Layer

#### [NEW] [patches.ts](file:///Users/mktsoy/Dev/flowr-app/src/data/patches.ts)
- Define types for patches: `Patch`, `PatchSection`, and `PatchType` (`'added' | 'fixed' | 'changed' | 'improved'`).
- Export a static array of mock/recent patches representing version `1.4.0` to `1.4.2`.

### 2. State & Types

#### [MODIFY] [store.types.ts](file:///Users/mktsoy/Dev/flowr-app/src/data/store.types.ts)
- Add `'updates'` to the `SettingsTab` union type.

### 3. UI Components

#### [NEW] [UpdatesSection.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/settings/UpdatesSection.tsx)
- Create a scrollable list of updates using clean cards.
- Add sections mapping each category (`Added`, `Fixed`, `Changed`, `Improved`) to colored tag badges and bullet items.

#### [MODIFY] [SettingsModal.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/modals/SettingsModal.tsx)
- Add the "What's New" tab to the sidebar navigation using `Sparkles` as the icon.
- Render `<UpdatesSection />` when `activeTab === 'updates'`.

#### [MODIFY] [SettingsPage.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/settings/SettingsPage.tsx)
- Add the "What's New" tab to the page sub-sidebar.
- Update header title and descriptions to match.
- Render `<UpdatesSection />` when `activeTab === 'updates'`.

---

## Tasks

### Task 1: Create the Data Structures
Create the data models and mock history entries.

**Files:**
- Create: `src/data/patches.ts`

**Step 1: Write mock test file**
- Write simple logic to assert that the updates data conforms to the schema.
- Since we don't have vitest running in the background, we can just compile and verify static type correctness.

**Step 2: Write implementation**
Create the file [src/data/patches.ts](file:///Users/mktsoy/Dev/flowr-app/src/data/patches.ts):
```typescript
export type PatchType = 'added' | 'fixed' | 'changed' | 'improved';

export interface PatchSection {
  type: PatchType;
  items: string[];
}

export interface Patch {
  version: string;
  build: string;
  date: string;
  title: string;
  sections: PatchSection[];
}

export const PATCHES: Patch[] = [
  {
    version: '1.4.2',
    build: '2306',
    date: '2026-06-17',
    title: 'Visual Polish & Switch Unification',
    sections: [
      {
        type: 'added',
        items: [
          'Added unified visual track color for all toggle switches in both light and dark themes.'
        ]
      },
      {
        type: 'fixed',
        items: [
          'Fixed stream termination hangs in chat completion responses.',
          'Resolved Gemini provider routing and advisor initialization errors.'
        ]
      },
      {
        type: 'changed',
        items: [
          'Unified assistant panel switches with the central Toggle component.'
        ]
      }
    ]
  },
  {
    version: '1.4.1',
    build: '2298',
    date: '2026-06-17',
    title: 'Mobile Optimization',
    sections: [
      {
        type: 'fixed',
        items: [
          'Fixed overlapping layout elements on mobile screen sizes.'
        ]
      }
    ]
  },
  {
    version: '1.4.0',
    build: '2280',
    date: '2026-06-16',
    title: 'Drag and Drop Experience',
    sections: [
      {
        type: 'added',
        items: [
          'Integrated Pragmatic Drag and Drop for kanban task list sorting.'
        ]
      }
    ]
  }
];
```

**Step 3: Commit**
```bash
git add src/data/patches.ts
git commit -m "feat: add patch updates schema and static mock data"
```

---

### Task 2: Extend the SettingsTab Type
Add `'updates'` to settings tab state.

**Files:**
- Modify: `src/data/store.types.ts`

**Step 1: Modify types**
Update line 205 in [src/data/store.types.ts](file:///Users/mktsoy/Dev/flowr-app/src/data/store.types.ts):
```typescript
export type SettingsTab = 'profile' | 'interface' | 'account' | 'notifications' | 'integrations' | 'subscription' | 'security' | 'admin' | 'logs' | 'updates';
```

**Step 2: Commit**
```bash
git add src/data/store.types.ts
git commit -m "feat: add updates to SettingsTab type definition"
```

---

### Task 3: Build the UpdatesSection Component
Create the visual feed component.

**Files:**
- Create: `src/components/settings/UpdatesSection.tsx`

**Step 1: Implement component**
Write code for [src/components/settings/UpdatesSection.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/settings/UpdatesSection.tsx):
```tsx
"use client";

import React from 'react';
import { PATCHES, PatchType } from '@/data/patches';
import { Sparkles, CheckCircle, RefreshCw, PlusCircle, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

const typeConfig: Record<PatchType, { label: string; color: string; icon: any }> = {
  added: {
    label: 'Added',
    color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400',
    icon: PlusCircle
  },
  fixed: {
    label: 'Fixed',
    color: 'text-blue-600 bg-blue-500/10 border-blue-500/20 dark:text-blue-400',
    icon: CheckCircle
  },
  changed: {
    label: 'Changed',
    color: 'text-amber-600 bg-amber-500/10 border-amber-500/20 dark:text-amber-400',
    icon: RefreshCw
  },
  improved: {
    label: 'Improved',
    color: 'text-purple-600 bg-purple-500/10 border-purple-500/20 dark:text-purple-400',
    icon: Sparkles
  }
};

export default function UpdatesSection() {
  return (
    <div className="space-y-6 animate-fade-in max-h-[600px] overflow-y-auto pr-1">
      {PATCHES.map((patch) => (
        <div 
          key={patch.version}
          className="p-5 rounded-2xl border border-[var(--bone-6)] bg-[var(--color-panel)] hover:border-[var(--bone-15)] transition-all duration-200"
        >
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg bg-accent/10 border border-accent/20 text-xs font-bold text-accent font-mono">
                v{patch.version}
              </span>
              <h4 className="text-[15px] font-bold text-[var(--bone-100)] tracking-tight">
                {patch.title}
              </h4>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--bone-40)] font-medium">
              <Calendar className="w-3.5 h-3.5" />
              <span>{patch.date}</span>
              <span className="opacity-40 font-mono">• Build {patch.build}</span>
            </div>
          </div>

          {/* Change Sections */}
          <div className="space-y-4 pt-1">
            {patch.sections.map((section, idx) => {
              const config = typeConfig[section.type] || typeConfig.changed;
              const Icon = config.icon;
              return (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border", config.color)}>
                      <Icon className="w-3 h-3" />
                      {config.label}
                    </span>
                  </div>
                  <ul className="space-y-1.5 pl-2">
                    {section.items.map((item, itemIdx) => (
                      <li 
                        key={itemIdx} 
                        className="text-[13px] leading-relaxed text-[var(--bone-70)] list-disc list-inside marker:text-[var(--bone-30)]"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Commit**
```bash
git add src/components/settings/UpdatesSection.tsx
git commit -m "feat: create UpdatesSection component with beautiful minimalistic timeline cards"
```

---

### Task 4: Integrate Tab in SettingsModal
Include updates tab in settings modal overlay.

**Files:**
- Modify: `src/components/modals/SettingsModal.tsx`

**Step 1: Update navigation and rendering**
Add the imports and the tab rendering logic.
- Add `{ id: 'updates', label: "What's New", icon: Sparkles }` to the `tabs` array.
- Render `{activeTab === 'updates' && <UpdatesSection />}`.

**Step 2: Commit**
```bash
git add src/components/modals/SettingsModal.tsx
git commit -m "feat: integrate What's New tab into SettingsModal"
```

---

### Task 5: Integrate Tab in SettingsPage
Include updates tab in full-page settings route.

**Files:**
- Modify: `src/components/settings/SettingsPage.tsx`

**Step 1: Update navigation, headers, and rendering**
- Add `{ id: 'updates', label: "What's New", icon: Sparkles }` to the `tabs` array.
- Add subtitle header text: `{activeTab === 'updates' && "Stay up to date with the latest additions, improvements, and fixes."}`.
- Render `{activeTab === 'updates' && <UpdatesSection />}`.

**Step 2: Commit**
```bash
git add src/components/settings/SettingsPage.tsx
git commit -m "feat: integrate What's New tab into SettingsPage"
```

---

## Verification Plan

### Automated Tests
- Run `npm run build` or Next.js build validation in non-sandbox context to ensure full TypeScript compilation.

### Manual Verification
- Launch the settings page and settings overlay modal.
- Verify both light and dark mode styling.
- Confirm vertical scrolling behavior of the timeline cards feed.
