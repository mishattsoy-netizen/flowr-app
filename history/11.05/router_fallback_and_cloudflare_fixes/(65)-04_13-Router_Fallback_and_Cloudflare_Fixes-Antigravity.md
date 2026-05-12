User request: "why clouflare models dont work and why does it say that each model was tried 2x times and same key was used 2 times"

### Objective Reconstruction
The goal was to diagnose and fix two critical issues in the AI routing system:
1.  **Redundant Retries**: The system was repeating failed API keys across multiple models, causing slow and repetitive failure logs.
2.  **Cloudflare Failures**: Cloudflare image models (like Flux) were failing, often due to timeouts or unhandled quota errors.

### Strategic Reasoning
-   **Key Rotation Memory**: The "Model-First" fallback logic was losing state between models. By ensuring `triedKeysCount` is updated before switching models, we prevent the system from re-trying known-bad keys for every model in the chain.
-   **Chain Deduplication**: Added a safety layer to filter out duplicate model IDs in the routing chain, preventing double-processing if the database contains accidental duplicates.
-   **Timeout Optimization**: Cloudflare's image generation is computationally heavy. Increasing the timeout from 30s to 60s prevents premature "System Overload" errors during busy periods.
-   **Error Categorization**: Explicitly catching 401/429 errors in the Cloudflare provider and tagging them as `KEY_EXHAUSTED` allows the router to intelligently skip that key for all subsequent models in the request.

### Detailed Blueprint
1.  **`src/lib/bot/chainRouter.ts`**:
    -   Implemented a `uniqueChain` filter using a `Set` of model IDs.
    -   Updated error handling to always increment the failed key index, ensuring the rotation moves forward.
2.  **`src/lib/bot/providers/cloudflare.ts`**:
    -   Increased `timeoutMs` to 60s for `IMAGE_GEN`.
    -   Updated `fetch` response validation to identify and throw auth/quota errors with a specific prefix.

### Operational Trace
-   **Modified**: `src/lib/bot/chainRouter.ts` - Fixed key rotation state management and added chain deduplication.
-   **Modified**: `src/lib/bot/providers/cloudflare.ts` - Extended timeouts and improved error reporting for authentication/limits.

### Status Assessment
Both issues are resolved. The routing chain should now move linearly through unique models and fresh keys without repetition. Cloudflare models have twice the previous time limit to complete image generation.

### Next Recommendation
Monitor the admin logs for any "KEY_EXHAUSTED" messages from Cloudflare. If they persist, it indicates a genuine quota limit or invalid token rather than a system bug.
