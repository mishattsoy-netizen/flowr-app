# History Report

## 0. Date and Time of the Request
Date: 2026-07-07  
Time: 17:13

## 1. User Request
User request:
```
how to make ai search better. @[c:\Users\misha\Documents\Dev\flowr-app copy\flowr-app copy\transcripts\ai-transcript-2026-07-07T14-05-31.md] i specified sonnet 4 and it searched NEW anthropic models, but i didnt specify othes and they are super outdated, not relevant at like: Gemini 1.5 Pro and Gemini 1.5 Flash, they are very old, there are already new models like gemini 3.1 pro ar gemini 3.5 flash lite. why this happened and how do we prevent that in the future and make ai knowladge/research accurate?
```

## 2. Objective Reconstruction
Analyze the root causes of outdated search results and raw command pollution in Tavily/Exa/DuckDuckGo searches, then implement improvements to query preprocessing and system prompts to ensure relevance and temporal accuracy.

## 3. Strategic Reasoning
- **Problem 1 (Query Pollution)**: The search engine was queried with raw, conversational user prompts including note creation commands and spelling errors (e.g. `create new note, inside crate a atble...`). Search engines return lower-quality, outdated hits when cluttered with command phrasing.
- **Problem 2 (Outdated Knowledge/Freshness)**: The AI model's training data cutoff is behind the current year (2026). When the search results contain old (2024) lists mentioning outdated models (like Gemini 1.5), the model fails to realize they have been superseded by newer models (Gemini 3.1/3.5).
- **Fix 1 (Query Preprocessing)**: Improved `cleanSearchQuery` inside `src/lib/bot/providers/tavily.ts` to actively strip command phrases (e.g., `create new note`, `inside create a table`, `make sure to add`), normalize typos, and extract clean keyword strings. Shared this function across Tavily, Exa (`src/lib/bot/providers/exa.ts`), and DuckDuckGo (`src/lib/bot/providers/duckduckgo.ts`).
- **Fix 2 (Freshness Rules)**: Injected a `TEMPORAL AWARENESS & FRESHNESS` instruction block into the `WEB_SEARCH` system prompt (`Final prompts(active)/chains/WEB_SEARCH/system_prompt.txt`), forcing the synthesis model to analyze search result dates and discard deprecated/superseded models (e.g. Gemini 1.5 Pro, Claude 3) in favor of 2025/2026 releases (Gemini 3.1 Pro, Claude 5) when building modern model comparisons. Synchronized changes directly to the Supabase database.

## 4. Detailed Blueprint
- **[tavily.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/lib/bot/providers/tavily.ts)**: Re-implemented and exported a highly robust `cleanSearchQuery` helper.
- **[exa.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/lib/bot/providers/exa.ts)**: Imported and applied `cleanSearchQuery` to pre-clean Exa queries.
- **[duckduckgo.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/lib/bot/providers/duckduckgo.ts)**: Imported and applied `cleanSearchQuery` to pre-clean DuckDuckGo queries.
- **[system_prompt.txt](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/Final%20prompts(active)/chains/WEB_SEARCH/system_prompt.txt)**: Added a rule enforcing temporal awareness and 2026 freshness guidelines.
- **[scratch.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/scratch.ts)**: Executed database sync upserting the updated prompts for the active app/telegram router chains.

## 5. Operational Trace
- Wrote and exported the optimized `cleanSearchQuery`.
- Wired the cleaning helper into Exa and DuckDuckGo provider files.
- Appended the temporal freshness rules to the `WEB_SEARCH` system prompt file.
- Ran `tsx scratch.ts` to sync the updated system prompts directly to Supabase (`platform: 'app'` and `'telegram'`).

## 6. Status Assessment
- **Resolved**: All search queries are now filtered to remove command boilerplate (like "create note" or "make a table"), ensuring high-precision query keywords.
- **Resolved**: AI models are now explicitly instructed to audit search result ages and deprecate/ignore old model releases (like Gemini 1.5) when generating current 2026 data.
