### 0. Date and time of the request
Date: 05.07.2026
Time: 05:53

### 1. User request
User request: "all pills must have same size!"

### 2. Objective Reconstruction
Align the sizes of all task metadata pills (attachment count, priority, tag, and workspace name) across both kanban task cards and list widgets.

### 3. Strategic Reasoning
Removed hardcoded heights (`h-[18px]`) and `leading-none` overrides entirely. Standardized all pills to use clean, consistent vertical padding (`py-0.5`) and horizontal padding (`px-2` or `px-1.5` for attachments). This naturally matches the rendering sizes of all text within the pills and ensures letter descenders (like 'g') are never clipped.

### 5. Files Changed
- `src/components/tracker/TaskCard.tsx`
- `src/components/workspace/widgets/SmartTaskStackWidget.tsx`

### 6. Status Assessment
Completed. All pills now share the same height and text boundaries.
