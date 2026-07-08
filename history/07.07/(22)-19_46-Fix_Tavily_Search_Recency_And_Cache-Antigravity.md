User request: "b, i restarted serrver and ai answered but im still not satisfied with answer. tabe still outdated the source wasnt good. i found better anser/inforamtion in one simple gogle search and first link, hw to we fix it?"

### 0. Date and time
2026-07-07 | 19:45 local time

### 1. User request
User asked why the AI's web search returned an outdated table of AI models, while a simple Google search found a much better, more current source (punku.ai from June 2026) as the very first result.

### 2. Objective Reconstruction
Improve the quality and freshness of Tavily web search results so that recent articles (published in the last ~2 months) are prioritized over older/outdated ones.

### 3. Strategic Reasoning
Two root causes were identified:

**Cause 1 - No recency filter:** `tavily.ts` was calling `client.search()` with no `days` parameter. The Tavily API supports a `days` parameter that restricts results to content published within that many days. Without it, Tavily can return articles from years ago as top results.

**Cause 2 - Stripping temporal keywords:** The `cleanSearchQuery()` function explicitly removed words like "right now", "currently", and "today" from the search query. These words are strong signals to search engines for prioritizing recent content. Removing them degraded result freshness.

As a bonus fix, the router chain cache was also set to `revalidate: 30` (from `revalidate: false`) so admin UI changes take effect within 30 seconds instead of requiring a full server restart.

### 4. Detailed Blueprint
- `src/lib/bot/providers/tavily.ts`: Remove `"right now"/"currently"/"today"` from the strip pattern; add `days: 60` to primary search and `days: 180` to the broader fallback search.
- `src/lib/router-config.ts`: Change `revalidate: false` to `revalidate: 30`.

### 5. Operational Trace
- Read `tavily.ts` in full to confirm the absence of a `days` filter and the presence of the temporal keyword stripping pattern.
- Removed the temporal keyword strip pattern (line 25 in original file).
- Added `days: 60` to the primary `client.search()` call.
- Added `days: 180` to the fallback `client.search()` call (broader fallback uses longer window to ensure some results are found).
- Changed `revalidate: false` to `revalidate: 30` in `router-config.ts`.

### 6. Status Assessment
Both fixes are applied. Tavily will now:
- Always include the word "today/currently" in the search query if the user used it, improving result freshness signals.
- Only return results from the last 60 days for primary searches, and last 180 days for fallback searches.
Router chain changes in the admin UI will now take effect within 30 seconds without a server restart.
