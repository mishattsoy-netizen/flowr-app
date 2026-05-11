User request: "@[current_problems]"

### 2. Objective Reconstruction
Triage and resolve high-priority TypeScript and structural compilation violations listed in the active environment IDE backlog.

### 3. Strategic Reasoning
The `HeaderBar.tsx` was throwing an implicit type error because I failed to append the optional flag to the standard interface model definition after relying upon it. Additionally, `ChatMessage.tsx` exhibited standard optional-prop hazards inside complex markdown parsers which warrant safe fallback operators.

### 4. Detailed Blueprint
- Add `cloudSyncEnabled?: boolean` to Entity schema.
- Patch `msg.content || ''` inside handleCopyToNote dispatcher.

### 5. Operational Trace
- **store.types.ts:** Inserted missing optional boolean declaration into the `Entity` model definition.
- **ChatMessage.tsx:** Wrapped parser call to explicitly protect against potential null/undefined string violations.
- Verified that `debug-gemma` error files are phantoms not present on current disk array.

### 6. Status Assessment
**HOTFIX COMPLETE.** Critical path TypeScript violations eliminated. Main app compile state verified green.
