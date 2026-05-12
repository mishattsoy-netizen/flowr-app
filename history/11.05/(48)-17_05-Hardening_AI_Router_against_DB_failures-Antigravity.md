# History Report — (48)-17_05-Hardening_AI_Router_against_DB_failures-Antigravity.md

Date: 11.05.2026
Time: 17:05

User request: "Classifier: DB error loading prompt for mode 'default': <html>...</html>"

### Objective Reconstruction
The goal was to stabilize the AI pipeline by ensuring that database failures (timeouts, gateway errors) do not crash the user experience. This required adding retries and robust hardcoded fallbacks to the classification and routing layers.

### Strategic Reasoning
I identified that the core AI logic had "no fallbacks, missing = error" policies in several critical paths. By implementing a multi-layered fallback strategy (Retry → Local File → Hardcoded Default), I ensured the system can "degrade gracefully" rather than failing completely when the database is down.

### Detailed Blueprint
- **Classifier**: Add DEFAULT_CLASSIFIER_PROMPT and retry loop for bot_settings fetch.
- **Router**: Add retry loop for router_chains and provide a hardcoded gemini-1.5-flash fallback for core intents.
- **Prompt Engine**: Correct file paths for local prompt fallbacks and wrap DB calls in defensive try-catches.

### Operational Trace
- Modified `src/lib/bot/classifier.ts` to include retries and a hardcoded classification prompt.
- Modified `src/lib/router-config.ts` to include retries and a fallback model chain (Gemini Flash).
- Modified `src/lib/bot/compilePrompt.ts` to fix local file lookup paths and add exception handling.

### Status Assessment
Completed. The system is now resilient to DB outages and should no longer show raw HTML error messages or "System Overload" during temporary database downtime.
