---
trigger: always_on
---

Global project rules for all agents:

- Never pull or checkout from GitHub without my explicit confirmation.
- When many changes have been made, or when it seems wise to create a safe restore point, recommend that I push the current version to GitHub.
- Regularly recommend clearing cache and restarting the server.
- Every time I ask to run the server, clear cache first.

Versioning and pushes:
- Every push must include a clear, structured description of what changed.
- If the current version is Flowr-1.1, the next push should increase the version by 0.1 unless I say otherwise:
  - Flowr-1.1 → Flowr-1.2 → Flowr-1.3, etc.
- When the version changes, update all mentions, labels, references, and dependencies that still point to the old version name.

Major version rule:
- When reaching a solid version number such as 2.0, create a full copy of the previous project state inside the `@versions` folder.
- Use archived versions only for reference, especially to check how older features were implemented.
- Never modify anything inside archived version folders without my permission.
- The active server must always run from the new main version folder, for example `flowr-2.0`.

Repository rule for major versions:
- When a major version is reached, create a new repository for that version, for example Flowr-2.0.
- After that, update all push/pull remote links to the new repository.

File naming rule:
- When versioning files that may conflict across versions, rename them to include the version number.
- Example:
  - `README.md` → `README-1.1.md`
- Apply this to all relevant `.md` files and other files that may cause version conflicts.