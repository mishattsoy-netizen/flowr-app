User request: "remove halucinated rpds"

### 1. Objective Reconstruction
The objective was to completely remove any guessed or estimated Requests Per Day (RPD) and Requests Per Minute (RPM) values that were manually mapped/assumed for providers when their endpoints did not explicitly return them. Instead, we revert them to `null` to display standard, authentic, and unmodified data representing actual API-supplied parameters.

### 2. Strategic Reasoning
- **Factual Integrity**: Since the respective APIs do not return standard daily/minute quotas within their `/models` endpoints, hardcoding estimates could cause confusion. Reverting them to `null` ensures that only exact data natively returned by the provider is ever shown.
- **Consistent Fallbacks**: Any unknown or unreturned limit now correctly renders as a clean dash (`—`) across all columns (RPD, RPM, Context, Max Out) under the Results Table.

### 3. Detailed Blueprint
- **`src/app/admin/discover/actions.ts`**:
  - Reverted `rpd` and `rpm` assignments to `null` inside `fetchGoogle`, `fetchGroq`, and `fetchOpenRouter`.

### 4. Operational Trace
- Edited `src/app/admin/discover/actions.ts` using `multi_replace_file_content` to clear the mapped RPD and RPM values.
- Verified successful compilation.

### 5. Status Assessment
- **Completed**: All guessed or estimated limits are successfully cleared and now elegantly render as dashes (`—`) as preferred.
