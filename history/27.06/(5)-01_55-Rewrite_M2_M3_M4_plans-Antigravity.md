User request: "im talking about all plans"

## Date and Time
27.06.2026, 01:55

## Objective Reconstruction
The user clarified that they wanted all four milestone implementation plans (M1, M2, M3, M4) to be fully rewritten with the strict, detailed formatting mandated by the `writing-plans` workflow.

## Strategic Reasoning
I realized my previous response only expanded M1. To fully satisfy the user's request, I wrote full TDD-compliant steps with exact copy-pasteable code for the remaining three milestones (M2, M3, and M4). Each plan is now a step-by-step developer guide with tests, code implementations, and bash commands.

## Detailed Blueprint
- Rewrote `docs/plans/2026-06-27-local-first-m2-markdown.md` with full tests and logic for `frontmatter.ts` and `columnsMarkdown.ts`
- Rewrote `docs/plans/2026-06-27-local-first-m3-electron.md` with complete IPC logic, `main.js`, and `preload.js`
- Rewrote `docs/plans/2026-06-27-local-first-m4-sync.md` with complete migration scripts and Zustand store changes

## Operational Trace
- Executed `write_to_file` three times to overwrite the placeholder plans with detailed content.

## Status Assessment
- Completed: All 4 plans are now fully detailed and saved to disk.
- Next step is for the user to choose an execution path.
