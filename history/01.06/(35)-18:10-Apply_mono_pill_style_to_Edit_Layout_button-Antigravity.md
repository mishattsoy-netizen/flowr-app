# 01.06.2026 18:10

User request: "apply it to edit layout pill"

## Objective Reconstruction
Apply the newly created "mono pill" design specification directly to the "Edit Layout" / "Done" button rendered in the header of the Bento Dashboard (`BentoDashboard.tsx`).

## Strategic Reasoning
To ensure design consistency as demanded by the visual protocol, the "Edit Layout" button must match the style of the suggestion pills on the Chat page. Since this button functions both as a static action (Edit Layout) and a toggled active action (Done), we applied the transparent stroke style as the idle/inactive state, and utilized the hover/filled state (`bg-[var(--app-dark)] border-transparent text-[var(--bone-100)]`) to cleanly represent the active/selected toggle state.

## Detailed Blueprint
- **[MODIFY]** [BentoDashboard.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/bento/BentoDashboard.tsx): Style the Edit Layout / Done button with the exact classes and transitions specified in `mono_pill.md`.
- **[MODIFY]** [mono_pill.md](file:///Users/mktsoy/Dev/flowr-app/BRANDING/mono_pill.md): Update the documentation to reflect that the `BentoDashboard.tsx` header action button now implements this design spec.

## Operational Trace
1. Opened `src/components/bento/BentoDashboard.tsx` and located the "Edit Layout" button at line 473.
2. Refactored the button's `className` to conditionally apply the `mono pill` styling based on `editMode` status using the `cn()` utility.
3. Updated the `mono_pill.md` spec document to reference `BentoDashboard.tsx` in the "Components Using This Spec" section.

## Status Assessment
- **Completed**: Fully migrated the "Edit Layout" button to follow the new Mono Pill specification.
- **Verification**: Verified correct syntax and correct styling integration with the existing grid layout.
