### 0. Date and time of the request
Date: 05.07.2026
Time: 05:55

### 1. User request
User request: "in widget pills dont have same size"

### 2. Fix
- Removed the remaining `leading-none` and `py-0.5` styling mismatch on the attachment and priority pills within `SmartTaskStackWidget.tsx`.
- Changed priority container from `div` to `inline-flex items-center` layout to match the other pills.
- Standardized all pills inside the widget list rows to have identical text height, baseline rendering, and padding boundaries.

### 5. Files Changed
- `src/components/workspace/widgets/SmartTaskStackWidget.tsx`

### 6. Status
Completed.
