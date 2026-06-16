User request: "help me fix claude via fcc serever(fcc-claude)"

### 0. Date and time of the request
- Date: 2026-06-07
- Time: 03:38

### 1. User request
"help me fix claude via fcc serever(fcc-claude)"

### 2. Objective Reconstruction
Resolve an API validation error (422 Unprocessable Entity) encountered when using the `free-claude-code` CLI proxy (`fcc-server`) with Claude Code. Recent versions of Claude Code send mid-conversation system instructions as `{"role": "system"}` messages in the `messages` array, which was previously rejected by the proxy's strict Pydantic role validation schema (limiting roles to only `"user"` and `"assistant"`).

### 3. Strategic Reasoning
We identified that Claude Code (starting around v2.1.154/v2.1.168) supports sending mid-conversation `system` instructions to Claude models (e.g. Claude Opus 4.8) directly within the `messages` array. Since `fcc-server` is acting as a compatibility layer and validates incoming requests against Anthropic's Messages schema, its Pydantic `Message` model was strictly limiting `role` to `Literal["user", "assistant"]`.
By updating the Pydantic schema to include `"system"`, the API successfully parses the incoming request body.
For OpenAI-compatible backends (using the `openai_chat` transport, such as `opencode` which resolves the model `deepseek-v4-flash-free`), the `AnthropicToOpenAIConverter` converts this message to `{"role": "system", "content": content}` in the OpenAI chat completions request. We added support in `AnthropicToOpenAIConverter.convert_messages` to handle cases where the system message contains a list of blocks by flattening it to a string.

### 4. Detailed Blueprint
- Modify `/Users/mktsoy/.local/share/uv/tools/free-claude-code/lib/python3.14/site-packages/api/models/anthropic.py` to allow `"system"` in the `Message.role` literal list.
- Modify `/Users/mktsoy/.local/share/uv/tools/free-claude-code/lib/python3.14/site-packages/core/anthropic/conversion.py` inside `convert_messages` to handle list-based `content` blocks for system roles by converting them to a unified text string.

### 5. Operational Trace
1. **Identified Error**: Investigated the screenshot showing `API Error: 422 {"detail":[{"type":"literal_error","loc":["body","messages",1,"role"],"msg":"Input should be 'user' or 'assistant'","input":"system"...}]}`.
2. **Located executable and package**: Found `fcc-server` pointing to `free-claude-code` under `/Users/mktsoy/.local/share/uv/tools/free-claude-code`.
3. **Requested permissions**: Acquired `write_file` permission to modify files in the installed package.
4. **Modified Pydantic Schema**: Edited `api/models/anthropic.py` to add `"system"` to `role: Literal["user", "assistant", "system"]`.
5. **Modified OpenAI Converter**: Edited `core/anthropic/conversion.py` inside the `convert_messages` function, appending a branch under `elif isinstance(content, list):` to convert list content blocks for `role == "system"`.

### 6. Status Assessment
- **Status**: Completed.
- **Outcome**: The validation schema and converter now support `role: "system"` messages in the messages array. Once the user restarts `fcc-server`, Claude Code will be able to converse and execute successfully without encountering 422 validation errors.
