# Task 3: Add the shared sync-file-scan helper module

**Files:**
- Create: `src/lib/syncFileScan.ts`
- Create: `src/lib/syncFileScan.test.ts`

## Requirements

### Module: `src/lib/syncFileScan.ts`

Exports:

1. **`parseVaultFile(fileName: string, content: string): ParsedVaultFile | null`**
   - Extracts `{ id, syncMode }` from vault file content
   - For `.canvas` files: parse as JSON, extract `entity.id` and `entity.syncMode`
   - For `.md` files: use `parseFrontmatter(content)` from `@/lib/editor/frontmatter`, extract `id` and `syncMode` from meta
   - Returns null if unparseable

2. **`listVaultFiles(vaultPath: string): Promise<Array<{ path: string; fileName: string; parsed: ParsedVaultFile }>>`**
   - Lists files in vault via `flowrFS.readdir(vaultPath)`
   - Filters to `.md` and `.canvas` only
   - Parses each with `parseVaultFile`, skips unparseable silently
   - Handles missing `flowrFS` gracefully (returns [])

3. **`findLocalFileForEntity(vaultPath: string, entity: { id: string }): Promise<string | null>`**
   - Uses `listVaultFiles` and finds first match by `parsed.id === entity.id`
   - Returns the file path or null

4. **`deleteVaultFile(path: string): Promise<void>`**
   - Calls `flowrFS.deleteFile(path)`
   - Handles missing `flowrFS` gracefully

5. **Re-exports `getVaultPath` from `@/lib/fileVault`**

### Exported types:
```typescript
export interface ParsedVaultFile {
  id: string;
  syncMode: string;
}
```

### Test file: `src/lib/syncFileScan.test.ts`

Tests for `parseVaultFile`:
- Parses markdown file frontmatter correctly
- Parses `.canvas` JSON format
- Returns null for unparseable content

Tests for `findLocalFileForEntity`:
- Finds file matching entity id from list
- Returns null when no file matches entity id

Mock `flowrFS.readdir` and `flowrFS.readFile` on `(window as any).flowrFS`.

## Dependencies

- `parseFrontmatter` from `@/lib/editor/frontmatter`
- `getVaultPath` from `@/lib/fileVault`
- `flowrFS` available as `(window as any).flowrFS`
