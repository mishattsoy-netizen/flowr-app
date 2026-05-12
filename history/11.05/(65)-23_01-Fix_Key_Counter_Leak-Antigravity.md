0. Date and time: 11.05.2026 23:01

1. User request: "Root Cause Analysis ... deepseek/deepseek-v4-flash silently skipped (REAL BUG)"

2. Objective Reconstruction:
Fix a critical bug in the chain router where the API key index was being incremented for non-exhaustion errors (like 404 Not Found), causing subsequent models in the same chain to be skipped erroneously when only one API key was available.

3. Strategic Reasoning:
- **Leak Identification**: The user correctly identified that `triedKeysCount[key]` was being incremented globally in the `catch` block, regardless of whether the error was a key-level exhaustion or a model-level failure.
- **Surgical Fix**: Moved the increment logic inside the `isKeyExhausted` check. This preserves the current key index for the next model in the chain if the current model failed due to a model ID mismatch (404) or other non-key issues.

4. Detailed Blueprint:
- **src/lib/bot/chainRouter.ts**:
    - Moved `triedKeysCount[key] = lastTried + 1` inside the `if (isKeyExhausted)` block.

5. Operational Trace:
- Modified `chainRouter.ts` to implement the fix.

6. Status Assessment:
- **Bug Fixed**: Deepseek and other fallbacks should now be correctly attempted even if the primary model in the chain (like Gemini 3.1) fails with a 404.
- **Provider Accuracy**: Confirmed "google/gemini-3.1-flash-lite" is an invalid ID on OpenRouter, explaining the initial failure.
