User request: "@[c:\Users\misha\Documents\Dev\flowr-app copy\flowr-app copy\src\lib\bot\tools\definitions.ts] remove old tools from here"

Objective Reconstruction
Remove placeholder utility tools from the `FLOWR_TOOLS` list in `definitions.ts` and their corresponding dummy handlers in `handlers.ts`. These tools included `get_crypto_price`, `fetch_web_page`, `tavily_search`, `exa_search`, `get_weather`, `convert_currency`, and `get_stock_price`.

Strategic Reasoning
These tools were unused dummy placeholders that could confuse the AI into attempting to use them instead of the core application capabilities. Removing them prevents the AI from falsely claiming it executed searches or fetched prices when the backend implementation simply returned "not configured".

Detailed Blueprint
- Edited `src/lib/bot/tools/definitions.ts` to remove the JSON definitions of the placeholder tools.
- Edited `src/lib/bot/tools/handlers.ts` to remove the asynchronous handler stubs for the same tools.

Operational Trace
- Used `replace_file_content` on both files to delete the relevant blocks of code.

Status Assessment
Completed successfully. The AI's tool definitions now strictly reflect actual available system capabilities.
