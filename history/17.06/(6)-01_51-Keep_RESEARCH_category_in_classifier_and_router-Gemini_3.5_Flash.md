User request: "keep research"

### 0. Date and time of the request
Date: 17.06.2026
Time: 01:51

### 1. User request
"keep research"

### 2. Objective Reconstruction
Modify the collapsed classifier configuration to retain and preserve `RESEARCH` as its own separate category (rather than mapping it to `WEB_SEARCH`). This includes updating the VALID_CATEGORIES array, default prompt, intent tag mapping, router-level normalization logic, grounding context, history truncations, and keyword SQL migrations.

### 3. Strategic Reasoning
- Retaining `RESEARCH` preserves the unique iterative deep research execution behavior in the router (namely, the `category === 'RESEARCH'` search loop running Exa/Tavily queries iteratively) that would otherwise have been lost if mapped to standard single-pass `WEB_SEARCH`.
- Gracefully handled downgrade guard conditions to ensure that if a user refers back to a prior uploaded image, the `RESEARCH` intent is downgraded to `COMPLEX` along with `WEB_SEARCH`.

### 4. Detailed Blueprint
- **Modified files:**
  - `src/lib/bot/classifier.ts` (added `'RESEARCH'` back to `VALID_CATEGORIES`, updated `DEFAULT_CLASSIFIER_PROMPT`, mapped `/research` to `RESEARCH` in `TAG_CATEGORY_MAP`, updated `guardCategory` check to downgrade RESEARCH to COMPLEX)
  - `src/lib/bot/chainRouter.ts` (removed `RESEARCH` -> `WEB_SEARCH` mapping in normalization block, updated `useGrounding` and `historyForChain` back to checking both `WEB_SEARCH` and `RESEARCH`)
  - `docs/migrations/2026-06-17-simplify-classifier-keywords.sql` (removed search category remapping query)

### 5. Operational Trace
1. Restored `RESEARCH` category in `VALID_CATEGORIES` list in `classifier.ts`.
2. Restored `RESEARCH` intent instruction in `DEFAULT_CLASSIFIER_PROMPT` in `classifier.ts`.
3. Updated `TAG_CATEGORY_MAP` to point `/research` to `RESEARCH` in `classifier.ts`.
4. Restored `RESEARCH` checking within `guardCategory` check to map to `COMPLEX` when image context is present in `classifier.ts`.
5. Removed `rawCategory = 'WEB_SEARCH'` override line for `RESEARCH` in `chainRouter.ts`.
6. Updated `useGrounding` and `historyForChain` ternary in `chainRouter.ts` to check `category === 'WEB_SEARCH' || category === 'RESEARCH'`.
7. Removed the remapping SQL statement from `simplify-classifier-keywords.sql`.
8. Checked git status.

### 6. Status Assessment
- **Completed:** `RESEARCH` is successfully retained as a distinct, first-class category in classification, routing, tag maps, and database configuration paths.
