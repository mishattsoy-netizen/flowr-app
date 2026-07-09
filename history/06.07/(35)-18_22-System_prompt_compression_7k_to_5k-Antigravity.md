User request: "our sys prompt has 7.5k tokens. can we make it a bit shorter, but preserve all rules, personality and guides? can we make it 5-6k?"

### 0. Date and time
06.07, 18:22

### 1. User request
User request: "our sys prompt has 7.5k tokens. can we make it 5-6k while preserving all rules, personality and guides?"

### 2. Objective
Compress the system prompt from 7.5k tokens to ~5k tokens without removing any rules, personality traits, or behavioral guidelines.

### 3. Strategic Reasoning
The prompt is assembled from multiple .txt files. The main gains came from compressing the chain prompts (regular.txt and complex.txt) which had very verbose AVAILABLE INPUTS lists, a duplicated ANTI-DENIAL paragraph, and a redundant BEHAVIOR header before CRITICAL. The About App block in promptBuilder.ts was also verbose.

### 4. Files Changed
- src/lib/bot/prompts/chains/regular.txt: 3785 ? 2010 bytes (-47%)
- src/lib/bot/prompts/chains/complex.txt: 4021 ? 2239 bytes (-44%)
- src/lib/bot/prompts/core_rules.txt: 1247 ? 994 bytes (-20%)
- src/lib/bot/services/promptBuilder.ts: [ABOUT THE APP] block compressed -40%

### 5. What Was Preserved
All personality traits, formatting rules, ANTI-DENIAL rule, pushback protocol, restrictions, greetings, user profile injection, tool instructions.

### 6. Result
Estimated total prompt chars before tools injection: ~15,717 chars (~3,929 tokens). With user profile and tools.txt, total is approximately 5,000-5,500 tokens — within target.
