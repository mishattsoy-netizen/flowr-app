User request: "ad accounts to clouflare provider and improve animations"

### 0. Date and time of the request
12.05.2026 - 06:25

### 1. User request
"ad accounts to clouflare provider and improve animations"

### 2. Objective Reconstruction
Migrate the Cloudflare provider from a singleton/hardcoded structure to the standard multi-account vault system and refine the UI interactions to be instant and high-end.

### 3. Strategic Reasoning
Unified the Cloudflare management with other providers (Gemini, Groq) to reduce code complexity and allow scaling to multiple Cloudflare accounts. Removed all animation delays (fade-ins) to make the UI feel "snappy" and professional, favoring color pulses over blurs.

### 4. Detailed Blueprint
- **Migration**: Link Cloudflare Token and ID to a new "Primary" account in `vault_accounts`.
- **UI**: Remove `CloudflareVaultWidget` and remove `animate-in` classes from `VaultProviderWidget`.
- **Logic**: Update `getProviderKeys` for Cloudflare to pull keys in index-order (Token=0, ID=1).

### 5. Operational Trace
- Updated `src/app/admin/vault/page.tsx` to include cloudflare in the main grid.
- Refactored `src/lib/bot/providers/cloudflare.ts` to use account-based retrieval.
- Modified `VaultProviderWidget.tsx` to strip out fade-in durations.
- Implemented emerald pulse feedback on copy.

### 6. Status Assessment
Completed. Cloudflare now supports multiple accounts and the UI is significantly faster.
