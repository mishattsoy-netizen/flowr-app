User request: "add ability to enable or dissable keys and final cleanup"

### 0. Date and time of the request
12.05.2026 - 06:30

### 1. User request
"add ability to enable or dissable keys and final cleanup"

### 2. Objective Reconstruction
Implement a kill-switch for individual vault keys and perform a final code cleanup to remove obsolete components and scripts.

### 3. Strategic Reasoning
Added an `is_active` status to individual keys to allow precise control over key rotation without deleting data. Ensured the AI system strictly respects this flag at the library level to prevent runtime errors when a key is disabled.

### 4. Detailed Blueprint
- **Schema**: Add `is_active` boolean to `public.vault`.
- **UI**: Add Power toggle to each key row; dim disabled keys and apply strikethrough to counters.
- **Cleanup**: Delete `CloudflareVaultWidget.tsx` and migration scratch files.

### 5. Operational Trace
- Altered `vault` table to include `is_active`.
- Added `toggleVaultKey` server action.
- Updated `VaultProviderWidget.tsx` with disabled states and "OFFLINE" labels.
- Verified and fixed a missing import in `cloudflare.ts`.
- Deleted obsolete files: `CloudflareVaultWidget.tsx`, `migrate_to_native_vault.ts`.

### 6. Status Assessment
Completed. The vault is now a highly controlled, professional secret management system.
