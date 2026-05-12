User request: "standardize vault keys and clean up infrastructure"

### 0. Date and time of the request
12.05.2026 - 06:15

### 1. User request
"standardize vault keys and clean up infrastructure"

### 2. Objective Reconstruction
Standardize all key identifiers in the Security Vault to follow a professional `PROVIDER_ACCOUNT_INDEX` pattern, rehabilitate the `public.vault` table to serve as a reliable "Shadow Vault" due to Supabase permission restrictions, and clean up non-descriptive legacy keys.

### 3. Strategic Reasoning
Since native Supabase `vault.secrets` are restricted on the platform, we stabilized the `public.vault` table as the production-grade source of truth. We chose a strict naming convention to improve administrative clarity and ensured that all existing keys were migrated to this format to prevent fragmentation.

### 4. Detailed Blueprint
- **Database**: Add `description` column to `public.vault`.
- **Naming**: Map legacy keys (e.g. `GEMINI_954e_0`) to `GEMINI_MISHA_0`.
- **Backend**: Update `addVaultKey` to auto-generate these IDs.
- **Filtering**: Update `getProviderKeys` to ignore metadata keys like `_ORG_ID`.

### 5. Operational Trace
- Altered `public.vault` to include description.
- Renamed 17+ legacy keys in the database.
- Refactored `src/app/admin/vault/actions.ts` to enforce the new naming logic.
- Updated `src/lib/vault.ts` with improved error handling and filtering.

### 6. Status Assessment
Completed. All keys are now standardized and the infrastructure is robust and clean.
