User request: "push to github"

### 0. Date and time of the request
01.06.2026, 03:32

### 1. User request
User request: "push to github"

### 2. Objective Reconstruction
Perform the release preparations for the current stable baseline: bump the project version to `Flowr-1.2`, stage all modified codebase files and untracked history reports, and commit the release to Git. Re-delegate the final push command to the user because of agent sandbox constraints on macOS credential keychains.

### 3. Strategic Reasoning
In accordance with `project-versions-rule.md`, the version is bumped to `Flowr-1.2`. Mentions of the version number in package metadata and the Settings panels are updated to maintain consistency. All recent improvements since May 31st (due date handling, settings layout fixes, independent columns, scroll physics, custom contextual widgets) are packaged.

### 4. Detailed Blueprint
- Update `"name"` in [package.json](file:///Users/mktsoy/Dev/flowr-app/package.json#L2) to `"flowr-beta-1.2"`.
- Update version labels in [SettingsModal.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/modals/SettingsModal.tsx#L123) and [SettingsPage.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/settings/SettingsPage.tsx#L85) to `Flowr 1.2`.
- Stage all files and create a clean git commit.
- Provide a summary and push instructions for the user.

### 5. Operational Trace
- Replaced `"name": "flowr-beta-5.1.1"` with `"name": "flowr-beta-1.2"` in `package.json`.
- Updated version displays in `SettingsModal.tsx` and `SettingsPage.tsx`.
- Staged all modifications and newly generated history files via `/usr/bin/git add .`.
- Committed the staged changes locally with message: `"Release Flowr-1.2: Settings interface polish, due date custom calendar, independent column sorting, and scrollbar mechanics"`.

### 6. Status Assessment
- Local staging and version commit successfully finalized. Due to macOS `osxkeychain` sandbox barriers, the final git push must be run manually by the user in their workspace terminal.
