# Vault Multi-Account Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable multi-account management in the Vault with sequential failover and a 5-key limit per account.

**Architecture:** Introduce a `vault_accounts` table to group keys by provider and status. Update `getProviderKeys` to fetch ordered keys from all active accounts. Refactor UI to show nested accounts.

**Tech Stack:** Next.js (App Router), Supabase (PostgreSQL), Tailwind CSS, Lucide Icons.

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260507_vault_multi_account.sql`

**Step 1: Write the migration SQL**

```sql
-- Create vault_accounts table
CREATE TABLE IF NOT EXISTS vault_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add account_id and key_index to vault table
ALTER TABLE vault ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES vault_accounts(id) ON DELETE CASCADE;
ALTER TABLE vault ADD COLUMN IF NOT EXISTS key_index INTEGER DEFAULT 0;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_vault_account_id ON vault(account_id);
CREATE INDEX IF NOT EXISTS idx_vault_accounts_provider ON vault_accounts(provider);
```

**Step 2: Run migration (Simulated/Local)**
Expected: Migration executes without error.

**Step 3: Commit**

```bash
git add supabase/migrations/20260507_vault_multi_account.sql
git commit -m "db: add vault_accounts table and relationships"
```

---

### Task 2: Data Migration Script

**Files:**
- Create: `scripts/migrate-vault.ts`

**Step 1: Write migration logic**
The script should:
1. Fetch all existing keys from `vault`.
2. Group them by provider (using `detectProvider` logic).
3. Create a "Primary" account for each provider.
4. Update `vault` rows to point to the new accounts.

**Step 2: Execute script**
Run: `npx tsx scripts/migrate-vault.ts`
Expected: Current keys are mapped to new accounts in the database.

**Step 3: Commit**

```bash
git add scripts/migrate-vault.ts
git commit -m "feat: add vault migration script"
```

---

### Task 3: Backend Logic Updates

**Files:**
- Modify: `src/lib/vault.ts`
- Modify: `src/app/admin/vault/actions.ts`

**Step 1: Update `getProviderKeys` in `src/lib/vault.ts`**
Implement the ordered fetch logic (active accounts first, then keys by index).

**Step 2: Update Actions**
Update `addVaultKey`, `deleteVaultKey`, etc., to require `accountId`. Add `addVaultAccount`, `toggleVaultAccount`, and `reorderVaultAccounts`.

**Step 3: Verify with unit tests**
Mock Supabase and verify `getProviderKeys` returns keys in correct order.

**Step 4: Commit**

```bash
git add src/lib/vault.ts src/app/admin/vault/actions.ts
git commit -m "feat: implement multi-account retrieval and actions"
```

---

### Task 4: UI Component Refactor

**Files:**
- Modify: `src/components/admin/VaultProviderWidget.tsx`
- Modify: `src/app/admin/vault/page.tsx`

**Step 1: Update `VaultPage` to fetch accounts**
Modify the server component to fetch hierarchical data (Accounts -> Keys).

**Step 2: Refactor `VaultProviderWidget`**
Implement the nested list view with Account headers and toggles.

**Step 3: Implement Account Actions**
Connect the UI to `addVaultAccount`, `toggleVaultAccount`, etc.

**Step 4: Commit**

```bash
git add src/components/admin/VaultProviderWidget.tsx src/app/admin/vault/page.tsx
git commit -m "ui: implement nested account view in vault"
```

---

### Task 5: Final Verification

**Step 1: Manual Test**
1. Add a second account for Gemini.
2. Toggle the first account OFF.
3. Verify that only keys from the second account are used (check via a small test script or logs).
4. Reorder accounts and verify the key array order changes.

**Step 2: Commit**

```bash
git commit -m "test: verify multi-account sequential failover"
```
