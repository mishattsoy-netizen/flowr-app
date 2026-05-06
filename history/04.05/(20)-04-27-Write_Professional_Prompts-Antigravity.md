User request: "write more proffesional and detailed class and sys promts"

### Objective Reconstruction
The user requested professional, detailed default prompts for both the System Prompt and Classifier Prompt in the Roadmap Planning Assistant configuration. The existing defaults were vague one-liners that produced generic output.

### Strategic Reasoning
1. **System Prompt:** Wrote a comprehensive "Flowr Roadmap Architect" persona that includes:
   - Specific knowledge of Flowr's tech stack (Next.js 16, React 19, Supabase, Turbopack, multi-provider AI router)
   - 6 explicit responsibilities (decompose, generate, write agent_prompts, analyze, prioritize, maintain consistency)
   - Behavior rules distinguishing when to produce action blocks vs. direct answers
   - Priority defaults for different task categories
2. **Classifier Prompt:** Wrote a structured intent classifier with:
   - Clear category definitions (COMPLEX, FAST, WEB_SEARCH, VISION) with concrete examples
   - Explicit decision rules (e.g., "greetings → FAST", "plan/create/build → COMPLEX", "when in doubt → COMPLEX")
   - Single-word output mandate
3. **Consistency:** The same professional defaults are now served from three places:
   - `roadmapRouter.ts` (runtime fallback when DB is empty)
   - `config/route.ts GET` (API response when DB has no config, so UI shows defaults)
   - User-editable via the BotConfigModal UI

### Detailed Blueprint
- `src/lib/bot/roadmapRouter.ts`: Updated `DEFAULT_SYSTEM_PROMPT` and `DEFAULT_CLASSIFIER` constants.
- `src/app/api/admin/roadmap/config/route.ts`: Updated GET fallback to return professional defaults instead of empty strings.

### Operational Trace
- System prompt is now ~20 lines of detailed persona and behavioral rules.
- Classifier prompt is now ~15 lines with structured categories and decision logic.
- Both are editable via the UI but have strong defaults out-of-the-box.

### Status Assessment
The Planning Assistant now has professional-grade prompts that will produce structured, actionable output. The user can further customize them via the Settings modal.
