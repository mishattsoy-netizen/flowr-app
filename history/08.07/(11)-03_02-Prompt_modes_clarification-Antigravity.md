User request: "which System Prompt says to change tone? do modes have differnt sys prompt files?"

### 2. Objective Reconstruction
Clarify to the user whether different chat modes use different system prompt files and identify where the tone-changing instruction is located.

### 3. Strategic Reasoning
I searched the `src/lib/bot/prompts/chains/` directory and found that the instruction `"Use the mode personality (Default or Pro) to determine tone and depth."` does not exist in the active text files (like `regular.txt` or `complex.txt`). It only exists in the database seed/backup file `bot configs(premission to edit needed!)\router-chains.json`. Furthermore, I verified that modes do not have separate prompt files; prompts are mapped by category, not mode.

### 4. Detailed Blueprint
- Answer the user directly.
- Clarify that the instruction is in an older JSON config/seed file and not in the active `.txt` prompts.
- Confirm that modes do not have different system prompt files.

### 5. Operational Trace
1. Grepped the codebase for `"Use the mode personality"`.
2. Checked `src/lib/bot/prompts/chains/regular.txt` and `complex.txt`.
3. Analyzed `promptBuilder.ts` and `chainRouter.ts` to see if `mode` is injected into the prompt.
4. Concluded that the system prompt is static per category, and modes only change the model chain.

### 6. Status Assessment
The user's query has been fully investigated and answered. No code changes were necessary.
