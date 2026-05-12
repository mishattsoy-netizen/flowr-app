User request: "Fix Module not found: Can't resolve './bot/logger' in router-config.ts"

## Date and time of the request
11.05.2026 15:35

## User request
"Fix Module not found: Can't resolve './bot/logger' in router-config.ts"

## Objective Reconstruction
Correct the broken import path for the logger in `src/lib/router-config.ts`.

## Strategic Reasoning
`router-config.ts` and `logger.ts` are both located in `src/lib/`. The previous import attempt was trying to look inside a `bot` subdirectory which doesn't contain the logger.

## Detailed Blueprint
- **src/lib/router-config.ts**: Changed import from `./bot/logger` to `./logger`.

## Operational Trace
- Identified the correct file structure using `list_dir`.
- Updated the import path.

## Status Assessment
- [x] Import path corrected.
- [x] Build should now succeed.
