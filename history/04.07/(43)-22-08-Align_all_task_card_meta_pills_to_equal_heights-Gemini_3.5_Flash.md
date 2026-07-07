### 0. Date and time of the request
Date: 04.07.2026
Time: 22:07 (Start) - 22:08 (End)

### 1. User request
User request: "make workspace and tag buttons same size as priority"

### 2. Objective Reconstruction
- Align the layout heights and font line heights of all status/meta pills (attachments, priority, tag, and workspace) rendered on the task card to be identical.
- Set a uniform height of `18px` (`h-[18px]`) with vertical flex-centering and `leading-none` for exact sizing.

### 3. Strategic Reasoning
- Previously, the priority pill did not have an explicit height and relied on default line-height, making it slightly taller (19px) than the tag/workspace pills which used `leading-none` (14px).
- Set an explicit `h-[18px]` and `inline-flex items-center` on all four meta pills (attachments, priority, tag, and workspace) to normalize layout scale.

### 4. Detailed Blueprint
- `src/components/tracker/TaskCard.tsx`: Apply `h-[18px] inline-flex items-center px-2 rounded-[6px] text-[10px] font-medium leading-none` sizing to all pills in the card footer metadata.

### 5. Operational Trace
- Replaced the template classes inside `TaskCard.tsx`.
- Verified TypeScript compilation.

### 6. Status Assessment
Completed successfully. All metadata pills in the task card footer are now aligned to a uniform 18px height.
