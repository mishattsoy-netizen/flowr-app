# History Report - Only Show Update Banner When Available

### 0. Date and Time
Date: 29.06.2026
Time: 15:34

### 1. User Request
User request: "hide update box in sidebar, only show it when update/new version available"

### 2. Objective Reconstruction
- Re-enable and restore the production check in the `UpdateBanner` component, so that the update notification container only displays when a new version has been detected and is downloaded/ready to install.

### 3. Strategic Reasoning
- The visual test override that bypassed the updater state checks has been removed, ensuring the component is hidden (returns `null`) under normal operation unless an update cycle is actively triggered by Electron's updater.

### 4. Detailed Blueprint
- **Files to Modify**: `src/components/layout/UpdateBanner.tsx` (change version checks to return `null` if update is not ready/available).

### 5. Operational Trace
- Replaced the hardcoded fallback value and visual bypass in `UpdateBanner.tsx` with conditional checks on `updateVersion` and `isReady`.

### 6. Status Assessment
- The component now correctly hides itself dynamically.
