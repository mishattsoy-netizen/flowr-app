User request: "change to flowr-beta-1.2"

### 0. Date and time of the request
01.06.2026, 03:33

### 1. User request
User request: "change to flowr-beta-1.2"

### 2. Objective Reconstruction
Explicitly overwrite the version of the application to `flowr-beta-1.2` (and display label `Flowr 1.2`) across the codebase, correcting the previous auto-incremented `5.2.0` layout.

### 3. Strategic Reasoning
Although the automatic version increment logic suggests `5.2.0`, the user's manual instruction takes absolute precedence. We directly updated the package.json and Settings screens to reflect `flowr-beta-1.2` / `Flowr 1.2`.

### 4. Detailed Blueprint
- Update name in [package.json](file:///Users/mktsoy/Dev/flowr-app/package.json#L2) to `"flowr-beta-1.2"`.
- Update labels in [SettingsModal.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/modals/SettingsModal.tsx#L123) and [SettingsPage.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/settings/SettingsPage.tsx#L85) to `Flowr 1.2`.

### 5. Operational Trace
- Changed version config to `flowr-beta-1.2` inside `package.json`.
- Synchronized settings panel labels to `Flowr 1.2`.

### 6. Status Assessment
- Overwrite complete. Version updated successfully to `flowr-beta-1.2` / `Flowr 1.2`.
