# Design Document: Vault Multi-Account & Key Management

**Date:** 2026-05-07
**Status:** VALIDATED
**Topic:** Infrastructure / Security Vault

## 1. Objective
Enable users to manage multiple provider accounts (e.g., multiple Gemini accounts) within the Security Vault. Each account can hold up to 5 keys. Accounts can be toggled ON/OFF manually. When an account is OFF, it and all its child keys are excluded from AI model chains. When multiple accounts for a provider are ON, the system utilizes them in a **Sequential Failover** order (Account 1 then Account 2).

## 2. Architecture & Database Schema

### 2.1 New Table: `vault_accounts`
This table manages the identity and status of account groupings.
- `id`: UUID (Primary Key, default gen_random_uuid())
- `provider`: TEXT (e.g., 'gemini', 'groq', 'openrouter')
- `name`: TEXT (User-defined name, e.g., 'Main', 'Backup')
- `is_active`: BOOLEAN (Default: true)
- `sort_order`: INTEGER (Determines priority in failover)
- `created_at`: TIMESTAMPTZ (Default now())
- `updated_at`: TIMESTAMPTZ (Default now())

### 2.2 Modified Table: `vault`
- `account_id`: UUID (Foreign Key to `vault_accounts.id`, ON DELETE CASCADE)
- `key_index`: INTEGER (0-4, enforces the 5-key limit)
- `key_id`: TEXT (Primary Key, remains for backward compatibility and internal ref)
- `encrypted_value`: TEXT
- `description`: TEXT

## 3. Core Logic (Vault Library)

### 3.1 Retrieval Flow (`getProviderKeys`)
1. Query `vault_accounts` where `provider = {provider}` and `is_active = true`.
2. Order by `sort_order` ASC.
3. For each account, fetch keys from `vault` where `account_id = {account.id}`.
4. Order keys by `key_index` ASC.
5. Decrypt and return a flattened array of keys.

### 3.2 Failover Strategy
- **Manual Sequential Failover**: By returning Account A's keys before Account B's keys in the array, the existing chain rotation logic naturally exhausts the primary account's pool before attempting the secondary account.
- **Manual Toggling**: Users must manually toggle accounts OFF in the UI if they wish to stop using an exhausted account.

## 4. UI/UX Design

### 4.1 VaultProviderWidget
- **Nested Layout**: Provider sections contain a list of Account Cards.
- **Account Card**:
    - Header with Drag Handle (reorder), Editable Name, Active Toggle, and Delete.
    - Body with Key list (up to 5 keys).
    - "Add Key" button (disabled if count >= 5).
- **Provider Actions**: "Add Account" button at the bottom of each provider section.

## 5. Migration Strategy

### 5.1 Automated Data Bridge
- **Step 1**: Identify existing keys in `vault`.
- **Step 2**: For each provider (detected by `key_id` prefix), create one "Primary" account in `vault_accounts`.
- **Step 3**: Assign all existing keys for that provider to the new "Primary" account.
- **Step 4**: Set `key_index` based on current numeric suffix or order.

## 6. Constraints & Edge Cases
- **Key Limit**: Strictly enforced at 5 keys per account.
- **Account Deletion**: Deleting an account must delete all its associated keys (handled by ON DELETE CASCADE).
- **Empty Accounts**: An active account with zero keys should not cause errors in `getProviderKeys`.
