
---

### Task 10: Verify and test the complete flow

- [ ] **Step 1: Apply migration and restart**

```bash
npx supabase migration up
npm run dev
```

- [ ] **Step 2: Test Discovery — paid models hidden by default**

Open `/admin/discover`, select OpenRouter, pick a vault key, click "Fetch Models". Verify:
- Only free-tier models appear (ending with `:free` or zero price)
- No paid models like `google/gemini-3.1-flash-lite` (without `:free`) are visible
- Each model shows a green "Free" badge

- [ ] **Step 3: Test Discovery — paid models visible with toggle**

Toggle "Show Paid Models" checkbox ON. Click "Fetch Models" again. Verify:
- Paid models now appear alongside free models
- Paid models show an amber "PAID" badge with per-token costs (e.g. `$0.000150 / $0.000600`)
- Free models still show green "Free" badge

- [ ] **Step 4: Test Add paid model — confirmation dialog**

Click "+ Add" on a paid model. Verify:
- A `window.confirm()` dialog appears with the model name and costs
- Click "Cancel" → model is NOT added, button stays as "+ Add"
- Click "+ Add" again, click "OK" → model IS added, checkmark appears

- [ ] **Step 5: Test Add free model — no confirmation**

Click "+ Add" on a free model. Verify:
- No confirmation dialog appears
- Model is added immediately, checkmark appears

- [ ] **Step 6: Test cost_log table**

After making requests using OpenRouter models, check the `cost_log` table:
```sql
SELECT * FROM cost_log ORDER BY created_at DESC LIMIT 10;
```
Verify token counts are being recorded.

- [ ] **Step 7: Test Router admin page**

Open `/admin/router`. If any paid models are in a chain, verify they show an amber "PAID" badge on the model chip.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat(paid-models): complete paid model support with guardrails and cost tracking"
```

---

### Task 9: Update OpenRouter runtime provider — log cost per request

**Files:**
- Modify: `src/lib/bot/providers/openrouter.ts`

- [ ] **Step 1: Extract usage info from OpenRouter response and log tokens**

After getting the response JSON (around line 52), add cost extraction:

```typescript
const data = await response.json()
const content = data?.choices?.[0]?.message?.content

// Extract usage/cost info from OpenRouter response
const usage = data?.usage
const promptTokens = usage?.prompt_tokens ?? 0
const completionTokens = usage?.completion_tokens ?? 0

// Fire-and-forget cost logging — non-blocking
if (promptTokens > 0 || completionTokens > 0) {
  import('@/app/admin/models/actions').then(({ logModelCost }) => {
    logModelCost({
      model_id: modelId,
      provider: 'openrouter',
      prompt_cost: 0,  // Computed later by joining models.prompt_cost in analytics
      completion_cost: 0,
      total_cost: 0,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
    }).catch(() => {})
  }).catch(() => {})
}
```

> **Note:** OpenRouter doesn't return dollar cost in the standard chat response body. The `prompt_tokens` and `completion_tokens` are logged, and actual dollar cost can be computed later by joining `cost_log.prompt_tokens * models.prompt_cost`.

- [ ] **Step 2: Commit**

```bash
git add src/lib/bot/providers/openrouter.ts
git commit -m "feat(paid-models): log OpenRouter token usage per request for cost tracking"
```
