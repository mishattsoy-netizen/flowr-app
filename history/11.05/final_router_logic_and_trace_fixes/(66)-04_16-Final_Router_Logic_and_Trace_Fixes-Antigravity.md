User request: "still not working, still repeating"

### Objective Reconstruction
The objective was to eliminate the persistent "repeating failure" behavior in the routing chain. Despite previous fixes, the system was still attempting the same dead API key for every model in the chain, causing slow performance and confusing logs.

### Strategic Reasoning
The root cause was identified as a "NaN" (Not a Number) reset loop:
-   **The NaN Bug**: When a model was skipped because its key was already marked as failed, the iteration index `k` was undefined. Calculating the next key as `k + 1` resulted in `NaN`.
-   **The Reset**: The next model in the chain would see `NaN` as a starting index, default back to `0`, and restart the entire search with the original dead key.
-   **Trace Clutter**: Models were being pushed to the routing trace as "failures" even when they weren't actually attempted due to exhausted keys.

### Detailed Blueprint
1.  **`src/lib/bot/chainRouter.ts`**:
    -   Modified `runChain` to use a safe `lastTried` variable instead of the loop-scoped `k`.
    -   Implemented logic to skip trace-pushing for models that were never attempted, cleaning up the UI.
    -   Upgraded deduplication to be case-insensitive (`.toLowerCase()`).
2.  **`src/lib/bot/providers/cloudflare.ts`**:
    -   Removed the `return null` catch-all, ensuring errors correctly propagate to the router for proper key rotation.

### Operational Trace
-   **Modified**: `src/lib/bot/chainRouter.ts` - Fixed the `NaN` key reset bug and cleaned up the routing trace logic.
-   **Modified**: `src/lib/bot/providers/cloudflare.ts` - Removed soft-catch to ensure authentic error propagation.

### Status Assessment
The routing logic is now logically sound and resilient to "soft" provider failures. If a key is dead, it is now permanently marked as dead for the duration of the request, and the routing trace will only show models that were actually invoked.

### Next Recommendation
Test with a known-bad key to confirm the trace now correctly skips models and moves directly to the next provider once all keys for the current provider are exhausted.
