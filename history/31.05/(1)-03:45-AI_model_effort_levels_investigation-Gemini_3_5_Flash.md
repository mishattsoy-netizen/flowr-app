User request: "what effort level is used for ai models in bot?"

### 0. Date and time of the request
May 31, 2026 at 03:45

### 1. User request
User asked: "what effort level is used for ai models in bot?"

### 2. Objective Reconstruction
Investigate the codebase to locate how the AI models in the bot (Flowr AI) configure, control, or calibrate their reasoning effort/cognitive depth.

### 3. Strategic Reasoning
Perform grep searches on `store.ts`, `chainRouter.ts`, the `Final prompts` folder, and bot configurations to trace settings like behavior modes, thinking parameters, and cognitive prompts. Answer the question comprehensively based on findings.

### 4. Detailed Blueprint
- Analyze client-side behavior mode settings (`aiBehaviorMode` / `thinkingEnabled` in Zustand store).
- Inspect backend routing pipeline and how `thinkingEnabled` triggers the `THINKING` pre-pass.
- Read prompt instruction files in `Final prompts/modes/` to understand the soft prompt-level cognitive calibration rules.
- Identify the dynamic model switching matrix routing logic.

### 5. Operational Trace
1. Grepped the codebase for "effort", "reasoning", "budget", and "thinking".
2. Found `aiBehaviorMode` in `store.ts` (`'fast' | 'thinking' | 'auto'`, defaults to `'auto'`).
3. Discovered `thinkingEnabled: boolean` toggling the `THINKING` chain pre-pass step in `chainRouter.ts`.
4. Read `thinking_pattern.txt` in both default and pro mode prompt folders to see how models are instructed to calibrate cognitive effort based on problem complexity.
5. Summarized findings clearly and answered the user.

### 6. Status Assessment
- **Completed**: Answered the user's question with full detail backed by the codebase analysis.
