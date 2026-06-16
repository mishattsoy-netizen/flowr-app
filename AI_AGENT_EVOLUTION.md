# AI Agent Evolution Specification: Flowr AI

## 1. Current State: The "Intent-Based Switching Matrix"
The current architecture of the Flowr AI agent is a **linear, branching pipeline**. It relies on pre-determining the user's intent before the primary "reasoning" model is even engaged.

### Current Flow:
`User Message` $\rightarrow$ `Vision Pre-check` $\rightarrow$ `Intent Classifier (LLM/Keyword)` $\rightarrow$ `Chain Retrieval (Supabase/Defaults)` $\rightarrow$ `Sequential Model Execution` $\rightarrow$ `Final Response`

### Key Components:
- **`src/lib/bot/classifier.ts`**: The bottleneck. It maps requests into categories (FAST, COMPLEX, TOOL_CALLING, etc.).
- **`src/lib/bot/chainRouter.ts`**: Orchestrates the sequence and handles model failover.
- **`src/lib/router-config.ts`**: Manages the model chains.

### Current Failure Modes (The "Pain Points"):
1. **Classifier Fragility**: If the classifier picks the wrong category, the agent uses the wrong prompt/model, leading to inconsistent answers.
2. **Tool Instability**: Tool calling is a "mode" rather than a "capability." The bot is routed to a tool chain, but it doesn't have a recursive loop to verify the tool output or correct itself.
3. **Internal Leakage**: The bot frequently "spits out" internal reasoning, system prompts, or raw thought blocks (e.g., `[THOUGHT]...[/THOUGHT]`) into the final user response.
4. **Lack of Synthesis**: The response is often a raw stream from the model, lacking a final "cleaning" or "synthesis" pass to ensure the output is user-facing and polished.

---

## 2. Target State: The "Agentic Reasoning Loop"
The goal is to move from a **Linear Matrix** to a **Recursive Loop**, similar to the architecture used by Claude, Gemini, and Hermes Agent.

### Target Flow:
`User Message` $\rightarrow$ `Context Assembly` $\rightarrow$ `Reasoning Loop` $\rightarrow$ `Output Guard` $\rightarrow$ `User Response`

### The Reasoning Loop (Recursive):
Instead of a classifier deciding if a tool is needed, the **Primary Brain** (the model) is given a set of available tools and decides on the fly:
1. **Reason**: Model analyzes the prompt and decides: *"Do I have the answer, or do I need a tool?"*
2. **Action**: If a tool is needed, the model emits a structured tool call.
3. **Observe**: The system executes the tool and feeds the **raw output back into the model's context**.
4. **Repeat**: The model looks at the observation and repeats Step 1 until it determines it has sufficient information to provide a final answer.

### The Output Guard (Sanitization):
To stop "leaking" internal thoughts, a post-processing layer must be implemented:
- **Thought Stripping**: Any text contained within reasoning tags (e.g., `<thought>`, `[REASONING]`) must be stripped before the message reaches the UI.
- **Synthesis Pass**: For complex tool-heavy tasks, the system should perform a final "Synthesis" call to turn the raw tool observations into a polished, human-readable response.

---

## 3. Implementation Directives for Antigravity

When refactoring the bot, focus on these core shifts:

### A. Decouple Tooling from Classification
- Stop using `classifier.ts` to route to `TOOL_CALLING`.
- Move tool definitions into the system prompt of the primary reasoning model.
- Implement a `while` loop in `chainRouter.ts` (or a new `agentLoop.ts`) that continues as long as the model is requesting tool calls.

### B. Transition to Function Calling
- Move away from "text-based" tool prompts. Use the native **Function Calling / Tool Use** APIs provided by the model providers (Google, OpenRouter, etc.). This significantly increases stability.

### C. Implement the "Hidden Thought" Pattern
- Instruct the model to always wrap its internal reasoning in specific tags.
- Implement a server-side filter that intercepts the model stream and removes these tags, ensuring the user never sees the "sausage being made."

### D. Enhance the Context Window
- Ensure the "Observation" from tool calls is injected back into the history with a clear `role: 'tool'` or `role: 'system'` marker so the model knows it's looking at external data, not user input.

## 4. Preferences & Quality Standards
- **Professionalism**: The bot should feel like a polished product. No internal logs, no raw JSON, and no "I am thinking..." text unless explicitly requested via a UI status indicator.
- **Reliability**: Prioritize stability in tool-calling over "cleverness." The agent should be able to fail gracefully and try an alternative tool if the first one fails.
- **Directness**: The final response should be concise and synthesized, not a dump of all the data found during the research process.
