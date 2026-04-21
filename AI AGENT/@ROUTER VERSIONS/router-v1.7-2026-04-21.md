# Router Update Plan — v1.7 (April 2026 Optimized)
Created: 2026-04-21
Last modified: 2026-04-21 02:10 by Antigravity (Gemini 2.0 Flash)
Corresponds to: FLOW_ROUTER_VERSION 13
Author: Antigravity
Status: DRAFT — awaiting user review

## Summary of Changes
- **GROQ PRIMARY**: Promoted Llama 3.3 70B and GPT-OSS 120B to primary slots across most categories due to high quality and reliable 1,000 RPD.
- **SEARCH NATIVE**: Updated `web_search` to favor GPT-OSS 120B (native search) and Gemini Grounding.
- **THINKING EXPANSION**: Added GLM 4.5 Air and Trinity Large as complex reasoning fallbacks.
- **IMAGE & VOICE UPGRADE**: Integrated Imagen 4 series and Gemini 3 Flash Live for better creative/audio performance.
- **EMBEDDINGS CATEGORY**: (Pending) Prepared for adding Embeddings category to the router system.

## Provider Quota Snapshot
- **Google AI Studio**: Gemini 3.1 Flash Lite (500 RPD), Gemini 2.5 Flash (20 RPD), Imagen 4 (25 RPD).
- **Groq**: Llama 3.3 70B (1,000 RPD), GPT-OSS 120B (1,000 RPD), Llama 3.1 8B (14,400 RPD).
- **OpenRouter**: Free tier models (Standardized at 200 RPD per user).

## Per-Category Routing Plan

### 1. `tool_call` (High Precision)
1. **llama-3.3-70b-versatile** (Groq | 1,000 RPD)
2. **openai/gpt-oss-120b** (Groq | 1,000 RPD)
3. **gemini-3.1-flash-lite** (Google | 500 RPD)
4. **nvidia/nemotron-3-super-120b-a12b:free** (OpenRouter | 200 RPD)
5. **qwen/qwen3-coder:free** (OpenRouter | 200 RPD)
6. **gemini-2.5-flash** (Google | 20 RPD)

### 2. `web_search` (Intelligence Layer)
1. **openai/gpt-oss-120b** (Groq | 1,000 RPD - Native Search)
2. **gemini-3.1-flash-lite** (Google | 500 RPD + Search Grounding)
3. **gemini-2.5-flash** (Google | 20 RPD + Search Grounding)
4. **llama-3.3-70b-versatile** (Groq | 1,000 RPD)
5. **nvidia/nemotron-3-super-120b-a12b:free** (OpenRouter | 200 RPD)

### 3. `complex` (Deep Reasoning)
1. **openai/gpt-oss-120b** (Groq | 1,000 RPD)
2. **qwen/qwen3-32b** (Groq | 1,000 RPD)
3. **gemini-3.1-flash-lite** (Google | 500 RPD)
4. **gemini-2.5-flash** (Google | 20 RPD)
5. **z-ai/glm-4.5-air:free** (OpenRouter | 200 RPD)
6. **arcee-ai/trinity-large-preview:free** (OpenRouter | 200 RPD)

### 4. `medium` (Balanced)
1. **llama-3.3-70b-versatile** (Groq | 1,000 RPD)
2. **qwen/qwen3-32b** (Groq | 1,000 RPD)
3. **openai/gpt-oss-120b** (Groq | 1,000 RPD)
4. **gemini-3.1-flash-lite** (Google | 500 RPD)
5. **gemma-4-26b-a4b-it** (Google | 1,500 RPD)
6. **minimax/minimax-m2.5:free** (OpenRouter | 200 RPD)

### 5. `fast` (Sub-second Latency)
1. **llama-3.1-8b-instant** (Groq | 14,400 RPD)
2. **openai/gpt-oss-20b** (Groq | 1,000 RPD)
3. **gemini-3.1-flash-lite** (Google | 500 RPD)
4. **google/gemma-3-12b-it:free** (OpenRouter | 200 RPD)
5. **nvidia/nemotron-nano-9b-v2:free** (OpenRouter | 200 RPD)

### 6. `image_generation` (Creative)
1. **imagen-4-fast-generate** (Google | 25 RPD)
2. **imagen-4-generate** (Google | 25 RPD)
3. **imagen-4-ultra-generate** (Google | 25 RPD)
4. **gemini-2.5-flash** (Google | 20 RPD - Image Mode)

### 7. `audio_voice` (Transcription & Speech)
1. **whisper-large-v3** (Groq | 2,000 RPD)
2. **whisper-large-v3-turbo** (Groq | 2,000 RPD)
3. **gemini-3-flash-live** (Google | Unlimited)
4. **gemini-2.5-flash-native-audio-dialog** (Google | Unlimited)

## Diff vs. Previous Version (v1.6)
- **ADDED**: Qwen3 Coder 480B, GPT-OSS 20B, GLM 4.5 Air, Trinity Large, MiniMax M2.5.
- **UPGRADED**: Llama 3.3 70B RPD increased/stabilized at 1,000.
- **REORDERED**: Pushed Groq models to #1 for better speed and reliable free quota.
- **BUMP**: `FLOW_ROUTER_VERSION` 12 -> 13.

## Priority Pool Update
Proposed `PRIORITY_MODELS`:
1. **llama-3.3-70b-versatile**
2. **openai/gpt-oss-120b**
3. **gemini-3.1-flash-lite**
4. **google/gemma-4-31b-it:free**
5. **qwen/qwen3-32b**

## Open Questions / Decisions Needed from User
- Should I add the `embeddings` category to `FlowIntentCategory` in `src/data/store.types.ts`?
- Do you want to keep `cloudflare-workers-ai` as primary for images (it was in v1.6 but not in your April list)?
