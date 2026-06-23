Date: 2026-06-17
Time: 01:55

User request: "also why did you remove regular, and advisor?we have specific chais with their own prompt and role why did you remove hem?"

### 2. Objective Reconstruction
Restore the `REGULAR`, `CODING`, and `ADVISOR` categories back into the classifier and chain router instead of collapsing them to `COMPLEX`. This allows Flowr to continue utilizing custom, database-configured prompts and chains for these distinct use cases, while dynamically enabling tool use across all text-based categories.

### 3. Strategic Reasoning
Collapsing categories like `REGULAR`, `CODING`, and `ADVISOR` to `COMPLEX` meant that Flowr could not leverage the tailored system prompts and roles defined in the Supabase database for those specific chains. To preserve this configuration while keeping tool-calling capabilities everywhere:
- We restored the custom categories to the classifier's prompt, tag mapping, list of valid categories, and guard rails.
- We updated the router to use the custom categories without remapping them to `COMPLEX`.
- We dynamically enabled `useTools` for all text categories: `['REGULAR', 'COMPLEX', 'CODING', 'TOOLS', 'ADVISOR']`.
- We enabled streaming for both `COMPLEX` and `REGULAR` categories.
- We deleted the now obsolete SQL migration that would have collapsed keyword configurations in the database.

### 4. Detailed Blueprint
- [src/lib/bot/classifier.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/bot/classifier.ts):
  - Retain `REGULAR`, `CODING`, and `ADVISOR` in the prompt, tags, valid categories, and image guard.
- [src/lib/bot/chainRouter.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/bot/chainRouter.ts):
  - Do not map `REGULAR`, `CODING`, or `ADVISOR` categories to `COMPLEX`.
  - Update `useTools` list to include `REGULAR`, `COMPLEX`, `CODING`, `TOOLS`, and `ADVISOR`.
  - Update `TEXT_STREAM_CATEGORIES` list to `['COMPLEX', 'REGULAR']`.
- [docs/migrations/2026-06-17-simplify-classifier-keywords.sql](file:///Users/mktsoy/Dev/flowr-app/docs/migrations/2026-06-17-simplify-classifier-keywords.sql):
  - Delete this file to prevent remapping keywords in the DB.

### 5. Operational Trace
- Inspected the current changes in `classifier.ts` and `chainRouter.ts`.
- Replaced the tool usage config and text streaming category settings in `chainRouter.ts` using `replace_file_content`.
- Deleted the file `/Users/mktsoy/Dev/flowr-app/docs/migrations/2026-06-17-simplify-classifier-keywords.sql`.
- Ran `/usr/bin/git status` to verify modified and deleted files.

### 6. Status Assessment
- All requested custom categories successfully restored to classifier and router.
- Tool use and token streaming are dynamically set.
- Redundant migration file removed.
