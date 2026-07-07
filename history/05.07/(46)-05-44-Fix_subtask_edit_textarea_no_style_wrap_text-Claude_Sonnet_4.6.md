### 0. Date and time of the request
Date: 05.07.2026
Time: 05:45

### 1. User request
User request: "dont change subtask style, size or add any effects on edit just focus on text, also when task is long remove scrollbar, instead move text to other row, max rows: 4"

### 2. Fix
- Replaced `<input>` with auto-resizing `<textarea>` in `SubtaskTextEditor`. Textarea starts at 1 row and grows up to 4 rows max. No border, no background, no visual style change when editing — completely invisible transition to edit mode.
- Display `<span>` now uses `break-words min-w-0` so long text wraps instead of overflowing.
- Row changed to `items-start` with `mt-[3px]` on checkbox and delete button to stay visually aligned at the top when text wraps.

### 5. Files Changed
- `src/components/tracker/TaskInspectorPanel.tsx`

### 6. Status
Completed.
