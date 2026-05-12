0. Date: 11.05.2026, Time: 14:20

1. User request
"are these setting the same thing, in the app ui i can set history limit, but there is hardcoded 3 turns history context"

2. Objective Reconstruction
Synchronize the "Conversation History Limit" UI setting with the backend logic for both intent classification and main conversation generation.

3. Strategic Reasoning
- **UI Settings Priority**: User preferences in the Admin panel should always override hardcoded optimizations.
- **Consistency**: Using the same history limit across all pipeline steps (classifier, router, providers) prevents confusion.
- **Optimization**: While the classifier is now dynamic, we pre-slice the history based on the user's limit before it even reaches the model, maintaining efficiency.

4. Detailed Blueprint
- `src/app/api/ai/chat/route.ts`: Fetch `historyLimit` from `pipelineSettings` and use it to bound the initial memory fetch.
- `src/lib/bot/classifier.ts`: Remove the hardcoded `slice(-6)` and use the history array provided by the caller.

5. Operational Trace
- Reordered the chat POST handler to fetch settings and history *before* classification.
- Updated `classifyIntentWithModel` to receive the bounded history.
- Cleaned up `classifier.ts` to remove the hardcoded 6-message constraint.

6. Status Assessment
- [x] UI slider now controls history depth for all AI operations.
- [x] Hardcoded turns removed.
