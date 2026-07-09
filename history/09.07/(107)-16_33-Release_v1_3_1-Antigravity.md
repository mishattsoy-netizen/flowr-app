User request: "actually lets do 1.3.1"

### 2. Objective Reconstruction
The user requested to release the newly developed tab sync and UI enhancements as version 1.3.1 instead of appending them to the 1.3.0 patch notes.

### 3. Strategic Reasoning
Following the automated release workflow rules, I removed the newly added lines from the 1.3.0 block in `src/data/patches.ts` and created a brand new `1.3.1` object at the beginning of the `PATCHES` array. This new object contains the correct user-friendly notes detailing the tab syncing, the middle-click functionality, and the visual/layout fixes in the split view. 

### 4. Detailed Blueprint
- Remove tab-sync and UI fix lines from `1.3.0` in `src/data/patches.ts`.
- Prepend a new `1.3.1` block to the `PATCHES` array in `src/data/patches.ts`.
- Stage all changes (`git add .`).
- Commit all changes with a release message (`git commit -m "chore: release v1.3.1"`).
- Provide the user with the command to push.

### 5. Operational Trace
- Edited `src/data/patches.ts` to remove the recent additions from 1.3.0.
- Prepend `1.3.1` patch notes to the start of `PATCHES` array in `src/data/patches.ts`.
- Used `git commit` to commit changes.

### 6. Status Assessment
The version bump is correctly logged in the patch notes. The code is staged and committed locally under the message `chore: release v1.3.1`. The user is ready to push this to trigger the automated release pipeline.
