User request: "why hter is no accounts on the vault?" (with a screenshot showing keys labeled "Key 1", "Key 2", etc., without account labels).

### 1. Objective Reconstruction
The objective was to implement and expose "Account" identifiers (names or labels) for the API keys stored within the Security Vault dashboard. The user noticed that multiple keys for providers like Gemini, Groq, and OpenRouter were generically labeled "Key 1", "Key 2", etc., without any way to identify the associated account or environment (e.g., "Personal", "Work", "Project X"). 

### 2. Strategic Reasoning
Upon reviewing `VaultProviderWidget.tsx` and the underlying database schema exposed in `src/app/admin/vault/actions.ts`, the `vault` table natively supports a `description` field. This field was being fetched but ignored by the UI. To solve the issue efficiently without schema migrations, the `description` field could be repurposed to serve as the user-defined Account Name. Both the UI and the backend actions needed an update to accept, display, and modify this field when adding or editing a vault key.

### 3. Detailed Blueprint
- Update `actions.ts`:
  - Modify `addVaultKey` to accept an optional `description` string and inject it into the database insert operation.
  - Modify `updateVaultKey` to accept an optional `description` string and dynamically build the update payload (allowing description-only updates if the user leaves the secret field empty).
- Update `VaultProviderWidget.tsx`:
  - Enhance `VaultKey` and `RowState` interfaces to include `description` and `editDescription`.
  - Modify the inline editing state to render two inputs: one text input for the Account Name (description) and one password input for the API Key value.
  - Modify the display state to render the `description` string inside an elegant pill badge alongside the generic "Key X" title.
  - Apply similar modifications to the "Add Key" row, ensuring new keys can be created with an Account Name from the start.

### 4. Operational Trace
- Edited `src/app/admin/vault/actions.ts`:
  - Refactored `updateVaultKey` to selectively patch `encrypted_value` and/or `description`.
  - Refactored `addVaultKey` to insert the `description`.
- Edited `src/components/admin/VaultProviderWidget.tsx`:
  - Mapped `k.description` onto the state initialization.
  - Injected an Account Name `<input>` into the `isEditing` block and `isAdding` block.
  - Added visual pills rendering `{row.description}` inline with the key title.
  - Adjusted the disabled state of the "Save" button to permit saving if only the description was changed.

### 5. Status Assessment
The Vault Account Management feature is now fully operational. Users can attach custom account names (e.g., "Personal", "Production") to all provider keys, and the UI elegantly displays them inline. This resolves the lack of context for vault keys.
