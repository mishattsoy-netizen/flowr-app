# Request History Report: Remove Calendar Icon from Date Pill and Align Workspace Cross

### 0. Date and time
Date: June 1, 2026  
Time: 02:27 AM

### 1. User request
User request: "when i press cross button i see calendar icon slide in animation, remove calendar from this pill completely. also position cross button in the workspace pill in the same place as in date pill"

### 2. Objective Reconstruction
Two visual issues needed fixing:
1. When clicking the cross to clear the due date, a calendar icon would slide/animate into view because it was conditionally rendered — removing the date triggered its appearance before the state updated. The fix: remove the icon entirely from the pill trigger.
2. The workspace pill had the X cross positioned as a flex child inside the button (flex `justify-between`), while the date pill cross was absolutely positioned at `right-2 top-1/2`. They needed to match.

### 3. Strategic Reasoning
**Calendar icon animation**: The icon was in `{!activeDate && <CalendarIcon ... />}` — a conditional render inside the trigger button. When the cross cleared the date, React first re-rendered with the icon appearing for one frame, causing a slide-in effect. Solution: remove the icon entirely. The placeholder text `dd/mm/yyyy` is sufficient to indicate the empty state.

**Workspace cross alignment**: The cross was a flex sibling inside the button — it moved with text and wasn't fixed in position. To match the date pill, the workspace section was wrapped in a `relative` div, the cross was removed from the button's flex layout, and an absolutely-positioned span was added as a sibling to the Popover — identical class and positioning as the date cross: `absolute right-2 top-1/2 -translate-y-1/2 z-20`.

### 4. Detailed Blueprint
- `date-time-picker.tsx`: remove `CalendarIcon` from inside the trigger button; always use `pr-8` on the button; simplify span class
- `NewTaskModal.tsx`: wrap workspace pill in `relative div`; change button from `px-3` to `pl-3 pr-8`; remove X span from inside button; add absolute X span as sibling to Popover

### 5. Operational Trace
1. Edited `date-time-picker.tsx`: removed `CalendarIcon` conditional render, simplified button padding to always `pr-8`
2. Edited `NewTaskModal.tsx`: added `relative` wrapper div around Popover; changed button to `pl-3 pr-8`; removed X from flex layout inside button; added absolute cross span after `</Popover>` with onPointerDown/onMouseDown/onClick handling; closed relative div properly
3. Ran `npx tsc --noEmit` → clean compile, zero errors

### 6. Status Assessment
- ✅ Calendar icon removed from date pill — no more slide-in animation when clearing date
- ✅ Workspace cross now absolutely positioned at `right-2 top-1/2`, matching the date pill exactly
- ✅ Both crosses use the same `onPointerDown` + `onMouseDown` preventDefault + z-20 approach
- TypeScript: zero errors
