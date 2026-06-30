# Task 1: Add task panel state to Zustand store

**Files:**
- Modify: `src/data/store.ts`

**Context:** This is the first task of the Task Inspector Panel feature. Add Zustand store state for a floating task inspection panel that replaces the AI assistant panel on the right side when a task card is clicked.

## What to do

### Step 1: Add initial state fields (~line 227)
Find `isAIAssistantOpen: false,`. Add right after it:
```typescript
isTaskPanelOpen: false,
activeTaskId: null as string | null,
taskPanelWidth: 500,
aiWasOpenBeforeTaskPanel: false,
```

### Step 2: Add actions (~line 379)
Find `toggleAIAssistant`/`setAIAssistantOpen` block. Add right after `setAIAssistantOpen`:
```typescript
openTaskPanel: (taskId) => set((state) => ({
  isTaskPanelOpen: true,
  activeTaskId: taskId,
  aiWasOpenBeforeTaskPanel: state.isAIAssistantOpen,
  isAIAssistantOpen: false,
})),
closeTaskPanel: () => set((state) => ({
  isTaskPanelOpen: false,
  activeTaskId: null,
  isAIAssistantOpen: state.aiWasOpenBeforeTaskPanel,
  aiWasOpenBeforeTaskPanel: false,
})),
setTaskPanelWidth: (width) => set({ taskPanelWidth: width }),
```

### Additional: Update toggleAIAssistant
Update `toggleAIAssistant: () => set((state) => ({ isAIAssistantOpen: !state.isAIAssistantOpen })),` to also close task panel when opening AI:
```typescript
toggleAIAssistant: () => set((state) => ({
  isAIAssistantOpen: !state.isAIAssistantOpen,
  isTaskPanelOpen: state.isAIAssistantOpen ? state.isTaskPanelOpen : false,
  activeTaskId: state.isAIAssistantOpen ? state.activeTaskId : null,
})),
```

### Step 3: Add to partialize (~line 2484)
Find `partialize:` block. Add `taskPanelWidth` after `aiSidebarWidth`:
```typescript
taskPanelWidth: state.taskPanelWidth,
```

### Step 4: Commit
```bash
git add src/data/store.ts
git commit -m "feat: add task panel state to store (isTaskPanelOpen, activeTaskId, taskPanelWidth)"
```

## Global constraints
- taskPanelWidth defaults to 500, persisted via partialize
