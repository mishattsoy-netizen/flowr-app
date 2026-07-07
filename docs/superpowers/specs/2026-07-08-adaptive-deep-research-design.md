# Adaptive Deep Research + Search Provider Tuning

## Problem

Multi-part user requests (e.g. "what are the best 10 LLMs right now under $X price
range, write a comparison table, make sure it includes model Y") fail to satisfy all
constraints. The AI focuses on one part (the list, or the price filter, or the
required inclusion) and drops the others.

Root causes, found by tracing the pipeline:

1. **Classifier misroutes these requests.** `RESEARCH` is defined too vaguely
   ("Exhaustive topic research and synthesis") and routing priority rule 5 sends
   *any* query naming a product straight to `WEB_SEARCH` before `RESEARCH` is ever
   considered. So a query like the example above never reaches the research chain
   at all — it gets one blended `WEB_SEARCH` query.
2. **Even inside `RESEARCH`, round 1 is a single blended query.** The raw prompt is
   sent to Tavily/Exa as-is. A single search cannot cleanly satisfy "ranked list" +
   "price ceiling" + "must include Y" simultaneously.
3. **Gap-detection is a weak, capped safety net.** `detectGaps` proposes at most 2
   follow-up queries and has no visibility into the user's *specific* constraints —
   it just looks for generic gaps in the findings so far.
4. **Final synthesis has no constraint checklist.** `getChainPrompt('research_pipeline')`
   falls back to a generic one-line default. Nothing tells the synthesis step to
   verify every part of the original request was addressed.

Separately, while tracing the search providers, three smaller issues were found:

5. **`searchExa` never requests page content.** Exa's `/search` endpoint returns
   metadata only unless `contents` is explicitly requested. `exa.ts` maps results as
   `r.text || r.snippet || ''`, but neither field is populated — every plain Exa
   search result has an empty `CONTENT:` block today.
6. **Extracted page content is uncapped.** `content-extract.ts` pulls full page text
   from Exa/Tavily with no character limit, inflating downstream LLM token cost.
7. **Tavily always uses `searchDepth: 'advanced'`** (2 credits/query), including in
   deep research's parallel fan-out, where the cost multiplies per sub-query.

## Design

### 1. Classifier: sharpen RESEARCH vs WEB_SEARCH

Redefine `RESEARCH` in `classifier.txt` around constraint count, not "depth":

- **WEB_SEARCH** (unchanged default): single-angle product/comparison queries,
  including plain "compare X vs Y" — comparison articles are a standard single-search
  result.
- **RESEARCH**: the query has 2+ independent constraints a single search is unlikely
  to satisfy at once — e.g. a ranked/list request combined with a filter (price
  range, date range) AND a specific required inclusion; or "compare X vs Y" *plus*
  an extra constraint ("...under $50/mo", "...that supports feature W").

Routing priority rule 5 changes from "names a product → WEB_SEARCH" to a branch:
multi-constraint → RESEARCH, single-constraint → WEB_SEARCH.

### 2. RESEARCH chain: planner replaces gap-detector loop

Current flow:

```
1 search -> gap-detector (LLM) -> up to 2 more searches -> synthesis (LLM)
```

New flow:

```
planner (LLM) -> N parallel searches (1-3) -> synthesis (LLM)
```

**Planner** (new first step, replaces gap-detector's role): reads the original
request and outputs:

```json
{
  "queries": ["...", "..."],
  "synthesisChain": "REGULAR" | "COMPLEX",
  "mustInclude": ["..."],
  "constraints": ["..."]
}
```

- `queries`: 1-3 targeted sub-queries, one per independent facet of the request.
  A single-facet request just returns `[originalQuery]` — degrades to
  today's single-search behavior.
- `synthesisChain`: which chain (REGULAR or COMPLEX) should write the final answer,
  chosen by the planner since it already has to read the request closely.
- `mustInclude`: named entities/items the answer must contain (presence-checkable).
- `constraints`: format/filter rules the answer must follow (price range, table
  format, etc.) — not presence-checkable, but stated explicitly for synthesis.

**Search step**: run all `queries` in parallel through the existing
`bestSearch`/`extractContent` machinery (unchanged provider logic besides the
tuning in section 4). No sequential rounds, no gap re-check — synthesis waits for
all N results.

**Synthesis step**: routed to the `synthesisChain` the planner picked, receiving
all findings plus an explicit checklist built from `mustInclude` and `constraints`
so it can self-verify before answering.

This removes `detectGaps`, the round-2 loop, and the `research_pipeline` generic
fallback prompt (replaced by the checklist-driven prompt). Net LLM call count is
unchanged (2: planner + synthesis, same as today's gap-detector + synthesis) —
only the search step becomes parallel-and-upfront instead of sequential-and-reactive.

### 3. Prompt changes

- `classifier.txt`: rewrite RESEARCH definition + rule 5 as above.
- New `chains/research_planner.txt`: instructs the planner LLM to extract queries/
  mustInclude/constraints/synthesisChain as JSON, mirroring the existing
  `deep_research_gap_detector.txt` style (JSON-only output, few-shot examples).
- Synthesis prompt: extend to inject the constraint checklist when present.

### 4. Search provider tuning (independent of the above, already agreed)

- `exa.ts` `searchExa`: add `contents: { text: { maxCharacters: 2000 } }` to the
  `/search` request body so results include real page text instead of empty
  `CONTENT:` blocks.
- `content-extract.ts`: cap Exa's `contents.text.maxCharacters` at ~4000 and
  truncate Tavily's `extract` result content to match, in both `extractViaExa`/
  `extractViaTavily` and `exa.ts`'s `extractExaUrls`.
- Tavily `searchDepth`: keep `'advanced'` for the single-shot `WEB_SEARCH` chain
  (`tavily.ts`); switch deep research's parallel sub-queries to `'basic'`
  (`deepResearch.ts`), since fan-out multiplies the credit cost.

## Out of scope

- WEB_SEARCH chain structure — untouched, stays single-query by design.
- Post-hoc validation of synthesis output against `mustInclude`/`constraints`
  (e.g. regex-checking the answer actually contains item Y). The checklist is
  advisory to the synthesis LLM, not enforced programmatically. Can be a follow-up
  if constraint misses persist after this change.
- Changing `numResults`/`maxResults` (5) or Exa search `type: 'auto'` — left as is.

## Testing

- Manual: run the original motivating example ("best 10 LLMs under $X, must
  include Y, as a table") through the classifier and confirm it routes to
  RESEARCH, the planner splits it into distinct queries, and the final answer
  contains a table, respects the price range, and mentions Y.
- Manual: run a plain "compare X vs Y" and confirm it still routes to WEB_SEARCH.
- Manual: run a single-facet product question and confirm RESEARCH (if reached)
  degrades to one query with no behavior regression.
