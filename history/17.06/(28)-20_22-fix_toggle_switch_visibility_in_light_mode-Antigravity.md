User request: "fix swtich is not visible in light mode when its toggled off. 3rd photo is reference how it should looklike"

0. Date and time of the request:
2026-06-17 20:21

1. User request:
"fix swtich is not visible in light mode when its toggled off. 3rd photo is reference how it should looklike"

2. Objective Reconstruction:
Fix the switch/toggle switches (for "Thinking" and "Advisor") in the assistant component so they are visible in light mode when toggled off. Make the track display a clear grey color in light mode rather than blending invisibly into the white panel background.

3. Strategic Reasoning:
- **Invisible Light-on-Light Track**: The toggled-off switch track used the `bg-white/10` style. While a 10% white overlay is visible against the dark panel in dark mode, it blends completely into the white/off-white panel background (`var(--color-panel)`) in light mode, rendering the toggled-off switch invisible.
- **Theme-Aware Track Color**: We make the background style theme-aware using `resolvedTheme`. In light mode, it defaults to a 15% black overlay (`bg-black/15`), which creates a beautiful, clear light-grey track against the white panel background, rendering the switch and its white thumb clearly visible, matching the reference design. In dark mode, it keeps the `bg-white/10` track.

4. Detailed Blueprint:
- [src/components/assistant/AIAssistant.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/assistant/AIAssistant.tsx): Update the class name of both toggle tracks inside the mode menu to dynamically toggle between `bg-black/15` (light mode) and `bg-white/10` (dark mode) when deactivated.

5. Operational Trace:
- Modified both switches inside [src/components/assistant/AIAssistant.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/assistant/AIAssistant.tsx) using theme-aware conditional backgrounds.
- Verified TypeScript compilation: `node node_modules/typescript/bin/tsc --noEmit` -> Success with 0 errors.

6. Status Assessment:
- Both Thinking and Advisor switches are now fully visible and styled correctly in both light mode and dark mode.
