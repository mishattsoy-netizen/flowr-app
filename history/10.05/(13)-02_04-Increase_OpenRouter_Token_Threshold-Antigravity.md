User request: "change max tokens to 5k"

## Objective Reconstruction
Increment the strict response generation token limit within the OpenRouter API provider construct from 2,000 to 5,000 units.

## Strategic Reasoning
User requested increased overhead for longer generated outputs while retaining the safety threshold infrastructure. 5,000 is a suitable limit that mitigates costs while enabling longer thinking operations.

## Detailed Blueprint
- Modify token constant in `openrouter.ts` JSON payload.

## Operational Trace
- Changed `max_tokens` setting from 2000 to 5000 inside the JSON construction block in `src/lib/bot/providers/openrouter.ts`.

## Status Assessment
Successful threshold escalation completed. Response output buffer is now widened to 5,000 tokens.
