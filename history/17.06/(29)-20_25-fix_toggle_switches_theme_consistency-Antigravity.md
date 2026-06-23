User request: "make sure all toggle switches across app look same in both themes"

0. Date and time of the request:
2026-06-17 20:25

1. User request:
"make sure all toggle switches across app look same in both themes"

2. Objective Reconstruction:
Unify all toggle switches across the entire application to look identical in both light and dark themes. Ensure that all toggles—whether in settings modals, kanban columns, or the assistant panel—use the standard toggle style with a visible theme-aware gray track background when toggled off.

3. Strategic Reasoning:
- **Style Divergence**: The settings panel modals used the `.toggle-switch` class defined in `globals.css`, while the assistant's "Thinking" and "Advisor" panels had custom inline-styled switches (`bg-black/15` vs `bg-white/10`).
- **Global Track Optimization**: By modifying the `.toggle-switch .toggle-label` selector in `globals.css` to use `background-color: var(--bone-15)` and `border: 1px solid transparent`, the standard switches are now styled with a clean, theme-aware gray track (`rgba(0, 0, 0, 0.15)` in light mode, `rgba(233, 233, 226, 0.15)` in dark mode).
- **Component Unification**: Replacing the custom HTML/CSS markup in `AIAssistant.tsx` with the `<Toggle size="sm" />` component unifies all toggle switch track colors, thumb alignments, and transition dynamics across the application.

4. Detailed Blueprint:
- [src/app/globals.css](file:///Users/mktsoy/Dev/flowr-app/src/app/globals.css): Update background color and border on `.toggle-label`.
- [src/components/assistant/AIAssistant.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/assistant/AIAssistant.tsx): Import `<Toggle>` and replace custom inline toggle HTML.

5. Operational Trace:
- Modified the `.toggle-switch .toggle-label` class in [globals.css](file:///Users/mktsoy/Dev/flowr-app/src/app/globals.css#L1014-L1025) to use `var(--bone-15)` background color.
- Replaced the custom toggle divs in [AIAssistant.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/assistant/AIAssistant.tsx#L1033-L1066) with `<Toggle>` components using `size="sm"` and `pointer-events-none`.

6. Status Assessment:
- All toggle switches throughout the application now share the same appearance in both light and dark themes.
