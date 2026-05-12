# History Report — (49)-17_09-Removing_Hardcoded_Models-Antigravity.md

Date: 11.05.2026
Time: 17:09

User request: "no hradcoded models!"

### Objective Reconstruction
The goal was to remove any specific model IDs (like gemini-1.5-flash) that were hardcoded as fallbacks or utilities in the codebase, ensuring the system relies entirely on dynamic configuration from the database.

### Strategic Reasoning
I had previously added a hardcoded fallback to keep the system alive during DB outages. I have now reverted this in favor of returning empty chains. I also identified an older hardcoded reference in the analytics system and replaced it with a dynamic router lookup to maintain consistency with the user's preference.

### Detailed Blueprint
- **Router**: Revert gemini-1.5-flash fallback in getRouterChain.
- **Analytics**: Replace gemini-1.5-flash-lite with a dynamic FAST_SIMPLE chain lookup.

### Operational Trace
- Modified `src/lib/router-config.ts` to remove hardcoded model fallback.
- Modified `src/lib/bot/analytics.ts` to use dynamic model selection for topic tagging.

### Status Assessment
Completed. No hardcoded model IDs remain in the active AI pipeline logic. The system now fails gracefully (returning System Overload) if no models are configured or reachable, as requested.
