# Router Update Plan — v1.6 (100k Scale Optimized)
Created: 2026-04-20
Last modified: 2026-04-20 20:43 by Antigravity (Gemini 2.0 Pro)
Corresponds to: FLOW_ROUTER_VERSION 1.6
Author: Antigravity
Status: DRAFT — awaiting user review

## Summary of Changes
- **IMAGE PRIMARY**: Promoted Cloudflare AI Workers to Primary (100k RPD).
- **SEARCH PRIMARY**: Promoted Google Search Grounding to Primary (1,500 RPD).
- **RATIO MAINTENANCE**: Preserved the 3:2 Ratio for all Text/Audio lists.
- **QUALITY FALLBACKS**: Kept Imagen 4 and Hugging Face as high-quality/variety fallbacks.

## Specialized Routing Plans

### 1. `IMAGE_GEN` (The 100k Pool)
1. **cloudflare-workers-ai** (Primary | 100,000 RPD)
2. **imagen-4-ultra-generate** (Google | 25 RPD - For "Premium" quality)
3. **imagen-4-fast-generate** (Google | 25 RPD)
4. **huggingface-stable-diffusion** (Hugging Face | Variety fallback)

### 2. `WEB_SEARCH` (Intelligence Layer)
1. **google-search-grounding** (Google | 1,500 RPD - Best for cited answers)
2. **tavily-search** (Vault Key | Secondary)
3. **duckduckgo-search** (Fallback | Unlimited)

### 3. `FAST_SIMPLE` (3:2 Ratio preserved)
1. **gemini-3.1-flash-lite** (Google)
2. **llama-3.1-8b-instant** (Groq)
3. **gemini-2.5-flash-lite** (Google)
4. **allam-2-7b** (Groq)
5. **gemma-3-4b** (Google)

### 4. `COMPLEX_THINKING` (3:2 Ratio preserved)
1. **llama-3.3-70b-versatile** (Groq)
2. **gemini-3-flash** (Google)
3. **openai/gpt-oss-120b** (Groq)
4. **gemini-2.5-flash** (Google)
5. **gemma-4-31b** (Google)

### 5. `AUDIO_VOICE` (Unlimited + Scale)
1. **gemini-3-flash-live** (Google | Unlimited)
2. **whisper-large-v3-turbo** (Groq | 2,000 RPD)
3. **gemini-2.5-flash-native-audio-dialog** (Google | Unlimited)
4. **whisper-large-v3** (Groq | 2,000 RPD)
5. **gemini-3.1-flash-tts** (Google)

## Key Technical Decisions
- **Web Search**: Using Search Grounding internally is much faster and cheaper than parsing external search results.
- **Image Generation**: Cloudflare is used for high-volume requests, while Imagen 4 is reserved for when the user asks for "highest quality" results.
