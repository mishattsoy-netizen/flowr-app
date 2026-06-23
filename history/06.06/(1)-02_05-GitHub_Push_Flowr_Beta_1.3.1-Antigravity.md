User request: "push to github 1.3.1"

### 0. Date and Time of the Request
Date: 06.06.2026
Time: 02:05

### 1. User Request
"push to github 1.3.1"

### 2. Objective Reconstruction
Commit all uncommitted local modifications, bump the project version to `Flowr Beta 1.3.1 (Build 2306)`, and push the branch to the remote repository `origin` on GitHub.

### 3. Strategic Reasoning
- The user requested a repository push with an explicit version tag of `1.3.1`.
- Bumped the version from `Flowr Beta 1.3` to `Flowr Beta 1.3.1` (Build 2306) across the configuration and UI display files.
- Staged all recent updates, which encompass prompt improvements for AI reasoning, shortcuts widget layout fixes, classifier optimizations, and a new test suite.
- Attempted to push the changes to origin, noting that network and filesystem isolation constraints in the IDE sandbox require the final push command to be run in an external terminal.

### 4. Detailed Blueprint
- **Version Bumps**:
  - `package.json`: Bump version string to `flowr-beta-1.3.1`
  - `src/components/modals/SettingsModal.tsx`: Bump version display and build number
  - `src/components/settings/SettingsPage.tsx`: Bump version display and build number
- **Modified & Staged Files**:
  - `Final prompts/chains/*`: Refined vision/research reconciliation parameters.
  - `src/components/workspace/widgets/ShortcutsWidget.tsx`: Layout improvements.
  - `src/lib/bot/classifier.ts` & `chainRouter.ts`: Optimized query classification and routing.
  - `src/lib/bot/classifier.test.ts`: Added unit tests for classification.

### 5. Operational Trace
1. **Verified Test Suite**: Ran `npx vitest run` and verified all 99 tests passed successfully (including the new classifier tests).
2. **Version Bump**: Replaced version details with `1.3.1` (Build 2306) across `package.json`, `SettingsModal.tsx`, and `SettingsPage.tsx`.
3. **Stage Files**: Staged all modified files and the untracked test file using `/usr/bin/git add -A`.
4. **Git Commit**: Ran `/usr/bin/git commit` to commit the staged code.
5. **Git Push**: Prompted user to run the push command externally.

### 6. Status Assessment
- **Completed**: Version bumped, changes committed locally to the `main` branch.
- **Pending/Action Required**: The final push to origin needs to be run in an external terminal due to IDE sandboxing.
- **Recommendation**: Run `git push origin main` in your terminal to complete the push.
