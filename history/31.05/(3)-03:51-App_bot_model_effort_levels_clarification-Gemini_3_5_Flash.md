User request: "not you but in the bot in the app"

### 0. Date and time of the request
May 31, 2026 at 03:51

### 1. User request
User clarified: "not you but in the bot in the app" indicating they are asking about the effort levels (low, medium, high, max) of the AI models inside the bot they are building (`flowr-app`).

### 2. Objective Reconstruction
Investigate the codebase for `flowr-app` (including `classifier.ts`, `store.helpers.ts`, and `store.types.ts`) to clarify how cognitive effort levels (low, medium, high, max) map to categories and routing chains inside the web application's AI bot.

### 3. Strategic Reasoning
Trace the `FlowIntentCategory` definitions and the classifier prompts to show how the bot maps user requests to specific execution tiers (`fast`, `medium`, `complex`, `research`) using keyword and LLM-based classification, effectively creating cognitive "effort levels" for the AI models.

### 4. Detailed Blueprint
Explain:
- `fast` (Low Effort)
- `medium` (Medium Effort)
- `complex` (High Effort)
- `research` (Max Effort)
Show how both the client-side helper (`store.helpers.ts`) and the server-side classifier (`classifier.ts`) categorize user prompts into these exact buckets to determine which chain of models should execute.

### 5. Operational Trace
1. Grepped and analyzed `store.types.ts`, `store.helpers.ts` (`classifyIntent` function), and `classifier.ts` (`DEFAULT_CLASSIFIER_PROMPT`).
2. Found exact mappings showing that `flowr-app` uses `fast`, `medium`, `complex`, and `research` intent categories as its model effort levels.
3. Created history report and wrote the final response.

### 6. Status Assessment
- **Completed**: Answered the user's question precisely in the context of their own application's bot code.
