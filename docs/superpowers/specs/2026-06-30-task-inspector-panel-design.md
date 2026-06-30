# Task Inspector Panel: Floating Side Panel Design

## Problem

The task detail/edit modal (`NewTaskModal`) currently opens as a **full-height right drawer** with a dark backdrop overlay that blocks interaction with the main content. When viewing tasks on the kanban board, clicking a task forces the user into a modal context — they cannot reference the board, click another task, or interact with the page behind it without closing the modal first.

## Goal

Convert the task detail modal into a **floating side panel** (like the existing AI Assistant panel) that:
- Opens on the right side without a backdrop overlay
- Keeps the main content fully interactive while open
- Is resizable (like the AI panel)
- Switches between AI panel and task panel depending on which is open
- Works identically in browser and desktop (PWA) modes

## Design

### Panel behavior

| State | Behavior |
|---|---|
| Click a task card (kanban, widget, etc.) | Right panel opens showing task detail/edit. If AI panel was open, it hides. |
| Click a different task while panel is open | Panel stays open, content swaps to the new task. |
| Click X / close button | Panel closes. If AI panel was open before, AI returns. |
| Click outside / backdrop | Nothing — no modal close behavior. Panel only closes via X. |
| Resize | Drag handle on panel's left edge, same as AI panel. |
| Save & Close | "Done" button saves and closes the panel. |
| Delete task | Delete removes the task and closes the panel. |

### Store changes (Zustand)

Add to store:
- `isTaskPanelOpen: boolean` — whether the task inspector panel is visible
- `taskPanelWidth: number` — resizable width (default ~500px, min 350px, max 600px)
- `activeTaskId: string | null` — currently displayed task ID

Modify existing state:
- `isAIAssistantOpen` — when task panel opens, AI panel auto-closes
- `isAIAssistantExtended` — unaffected, AI panel preserves its extended/collapsed state

Add actions:
- `openTaskPanel(taskId: string)` — opens the panel with the given task; auto-closes AI panel
- `closeTaskPanel()` — closes the panel; restores AI panel if it was previously open
- `setTaskPanelWidth(width: number)` — resize handler

### Component changes

#### `NewTaskModal.tsx` → split into two concerns:

1. **TaskPanelHeader** — the shell (close button, resize handle, title area)
2. **TaskPanelContent** — the existing form (title, status, priority, due date, description, subtasks, footer)

The panel component:
- Removes the `fixed inset-0` backdrop wrapper
- Removes the `bg-black/25` overlay
- Removes outside-click-to-close behavior
- Removes `z-[200]` modal stacking
- Adds resize handle on the left edge (matching AI panel pattern)
- Uses the same transition/animation classes as the AI panel

#### `Shell.tsx` changes:

The right panel area currently renders:
```tsx
{hasHydrated && isAIAssistantExtended && activeEntityId !== 'chat' && <AIAssistant />}
```

It will render:
```tsx
{isTaskPanelOpen && activeTaskId
  ? <TaskPanel />
  : (hasHydrated && isAIAssistantExtended && activeEntityId !== 'chat' && <AIAssistant />)
}
```

The right panel container already supports `transition: width 300ms` and conditional rendering — the task panel slots into the same area.

#### `TaskCard.tsx` changes:

Currently opens the modal:
```tsx
openModal({ kind: 'newTask', taskId: task.id });
```

Changes to:
```tsx
openTaskPanel(task.id);
```

### Layout

```
┌────────┬──────────────────────┬──────────────┐
│        │                      │   AI/        │
│Sidebar │   Main Content       │   Task       │
│        │   (fully             │   Panel      │
│        │    interactive)      │   (resizable)│
│        │                      │   ← drag     │
└────────┴──────────────────────┴──────────────┘
```

- Same right-panel wrapper as AI (uses `Shell.tsx`'s resizer logic)
- Same `bg-sidebar`, `rounded-2xl`, `shadow-sm` styling as AI panel
- Width stored in `taskPanelWidth` (separate from `aiSidebarWidth`)

### Edge cases

| Scenario | Behavior |
|---|---|
| Task is deleted from panel | Panel closes, AI restores if it was open before |
| Task saved via "Done" | Panel closes, AI restores |
| AI panel toggled on while task panel is open | Task panel closes, AI opens |
| User navigates to different page | Panel closes (task is no longer relevant) |
| Desktop (PWA) mode | Same behavior — `isDesktop()` check only affects shell padding/gaps |
| Mobile (<768px) | Panel should not auto-show. Tasks open the full-page `NewTaskModal` instead (current modal behavior, which works well on mobile). |

### Resize behavior

- Uses the same `mousemove`/`mouseup` resize logic in `Shell.tsx`
- Resize handle identical to the AI panel's handle (2px w, positioned at panel's left edge)
- `pointer-events: auto` on the handle so it catches mouse events even when the panel is narrow

## Files changed

| File | Change |
|---|---|
| `src/data/store.ts` | Add `isTaskPanelOpen`, `taskPanelWidth`, `activeTaskId` state + actions |
| `src/data/store.types.ts` | Add types for new task panel state |
| `src/components/modals/NewTaskModal.tsx` | Refactor into `TaskPanel` component (remove backdrop, wrap in panel shell) |
| `src/components/tracker/TaskCard.tsx` | Change `openModal` → `openTaskPanel` |
| `src/components/layout/Shell.tsx` | Add task panel to right-side panel slot, wire up resize, manage open/close |
| Any task-opening surface that uses `openModal({ kind: 'newTask', taskId })` | Same change as TaskCard |

## Verification

1. Open kanban page → click a task card → right panel opens with task detail, no backdrop, main content clickable
2. Resize the panel by dragging its left edge
3. Close panel via X → main content still on same page
4. Click another task while panel is open → panel content swaps
5. Click AI toggle → task panel closes, AI panel opens
6. Delete a task → panel closes
7. Mobile (<768px) → task opens as full-screen modal (existing behavior)
8. Workspace/Dashboard widgets → clicking through to task opens panel, not modal
