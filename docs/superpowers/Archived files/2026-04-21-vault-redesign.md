# Vault Page Redesign — Design Spec
Date: 2026-04-21

## Overview

Replace the current flat "all keys in one list + top register form" vault page with a **grid of per-provider widgets**, matching the RouterManager visual pattern. Each widget manages its own provider's keys with inline add, reveal, edit (secret value), reorder, and delete.

---

## Layout

- 2-column grid (same as RouterManager on router page)
- One widget per provider: Gemini, Groq, OpenRouter — extendable via the existing `getProviderInfo` logic
- Page header unchanged: "Security Vault" + subtitle
- No separate top-level register form — adding lives inside each widget

---

## Key Naming & Migration

**Display names:** Keys are displayed as "Key 1", "Key 2", etc. — their position within the provider widget determines the label. No user-entered names.

**DB key_id format:** `PROVIDER_N` (0-indexed), e.g. `GEMINI_0`, `GEMINI_1`, `GROQ_0`.

**Migration:** On first save (any mutation — add, delete, reorder) for a provider's key list, all keys for that provider are renamed sequentially in the DB to match their new positions: `PROVIDER_0`, `PROVIDER_1`, etc. This is handled server-side in a new `reorderProviderKeys` server action that runs atomically.

---

## Provider Widget

Each widget (`VaultProviderWidget`) is a self-contained client component.

**Header:**
- Colored dot + provider name (uppercase, low opacity)
- Key count on the right

**Rows (one per key):**
- Position index (1-based, read-only label)
- Display name: "Key N" (derived from index)
- Masked value: `••••••••••••••••••••••••` by default
- Actions: reorder ▲▼, reveal 👁, edit ✏️, delete 🗑

**Row states:**
1. **Default** — masked value, all 4 actions visible
2. **Revealing** — spinner + "Decrypting..." while `revealVaultKey` fetch is in flight
3. **Revealed** — partial plaintext shown, eye icon highlighted; clicking eye again re-masks
4. **Editing** — value field replaced by text input pre-filled with revealed value (or empty if not yet revealed), Save + cancel (X) replace reorder/eye actions; calls `updateVaultKey`
5. **Deleting** — row fades to 20% opacity while delete is in flight; row removed on success

**Reorder arrows:**
- ▲ disabled on first row, ▼ disabled on last row
- Swaps positions locally, then calls `reorderProviderKeys` to persist all positions atomically

**Add key:**
- Dashed "＋ Add key" button at bottom of each widget
- Clicking appends a new editing row (empty value input, auto-named "Key N+1")
- Save calls `addVaultKey(PROVIDER_N, value)` with the auto-generated key_id

---

## Server Actions (new/modified)

All in `src/app/admin/vault/actions.ts`:

| Action | Change |
|--------|--------|
| `getVaultKeys` | Sort by `key_id` ascending (already correct after migration) |
| `addVaultKey` | Accept provider + index, auto-generate key_id as `PROVIDER_N` |
| `updateVaultKey` | No change |
| `deleteVaultKey` | No change |
| `revealVaultKey` | No change |
| `reorderProviderKeys(provider, orderedKeyIds[])` | **New** — renames all keys for a provider atomically to `PROVIDER_0..N` matching the given order array |

> Sorting is by `key_id` (alphabetical). Since key_ids are always in `PROVIDER_N` format after migration, this gives stable positional order with no extra DB column needed.

---

## Components

| File | Change |
|------|--------|
| `src/app/admin/vault/page.tsx` | Replace single list + register form with `<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">` + one `<VaultProviderWidget>` per detected provider |
| `src/components/admin/VaultProviderWidget.tsx` | **New** — full widget component (replaces VaultItem + VaultRegisterForm) |
| `src/components/admin/VaultItem.tsx` | **Deleted** — replaced by VaultProviderWidget rows |
| `src/app/admin/vault/VaultRegisterForm.tsx` | **Deleted** — add flow moves into VaultProviderWidget |

---

## Provider Detection

Providers are derived from existing keys using `getProviderInfo(key_id)`. The page groups keys by provider name. A hardcoded list of known providers ensures empty widgets appear even if no keys exist yet: `['gemini', 'groq', 'openrouter']`. Unknown keys go into a "General" widget.

---

## DB Migration

No schema changes needed. The existing `key_id` column is the canonical identifier and sort key. `reorderProviderKeys` renames keys in-place using `UPDATE ... SET key_id = ... WHERE key_id = ...` for each position, run sequentially in the same server action.

---

## Out of Scope

- Adding new provider types (hardcoded list for now)
- Bulk operations
- Key descriptions/labels beyond auto-numbering
- Drag-and-drop reorder (arrow buttons only)
