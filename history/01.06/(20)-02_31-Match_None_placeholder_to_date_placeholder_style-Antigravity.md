# Request History Report: Match None Placeholder to Date Placeholder Style

### 0. Date and time
Date: June 1, 2026  
Time: 02:31 AM

### 1. User request
User request: "make none placeholder same color as date placeholder and same hover"

### 2. Objective Reconstruction
The "None" text in the workspace pill had different styling from the date pill placeholder ("dd/mm/yyyy") — it was brighter (bone-60) and changed color on hover. The user wanted them to look identical.

### 3. Operational Trace
- Changed workspace None button from `bg-bone-6 text-bone-60 hover:text-bone-100 transition-colors` to `bg-[var(--bone-6)] text-[var(--bone-30)] hover:bg-[var(--bone-10)] transition-none`
- Matches date pill placeholder: same muted bone-30 color, same bg and hover behavior, no text color change on hover

### 4. Status Assessment
- ✅ "None" now matches "dd/mm/yyyy" placeholder visually
