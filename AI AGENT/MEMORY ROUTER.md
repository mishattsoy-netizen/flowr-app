# MEMORY ROUTER
This file tracks patterns, preferences, and RPD history for the AI Router.

## April 2026 Free Tier Landscape
- **Groq dominance**: Llama 3.3 70B and GPT-OSS 120B are the current "workhorses" with 1,000 RPD and high intelligence.
- **Google Flash Lite**: Reliable 500 RPD fallback with great context windows.
- **OpenRouter Free Tier**: Standardized at 200 RPD per user. Use for niche/variety models like GLM or Qwen Coder.
- **Search Grounding**: Prefer native search grounding (Google) or search-capable models (GPT-OSS 120B) for `web_search` intent.

## Preferences
- **Speed**: Prioritize Groq for low-latency text.
- **Reliability**: Keep a mix of Google/Groq/OR so a single provider outage doesn't break the app.
- **Image Scale**: Cloudflare Workers AI (100k RPD) is preferred for scale, but Imagen 4 (25 RPD) is preferred for quality.

## RPD History
- Llama 3.3 70B (Groq): 1,000 (v1.7)
- GPT-OSS 120B (Groq): 1,000 (v1.7)
- Gemini 3.1 Flash Lite: 500 (v1.7)
- Gemma 4 31B/26B: ~1,500 (v1.7)
- Llama 3.1 8B (Groq): 14,400 (v1.7)

## Router Updates
- **2026-04-20**: Finalized v1.6 plan (100k Scale Optimized) for Telegram.
- **2026-04-21**: Applied v1.7 plan (April 2026 Optimized) to Web App.
  - `WEB_SEARCH`: Switched to Google Search Grounding (1,500 RPD) as primary.
  - `COMPLEX_THINKING`: Llama 3.3 70B (1,000 RPD) as primary.
  - `IMAGE_GEN`: Cloudflare (100,000 RPD) as primary.
  - `AUDIO_VOICE`: Gemini 3 Flash Live as primary.
  - `FLOW_ROUTER_VERSION`: Bumped to 13.
