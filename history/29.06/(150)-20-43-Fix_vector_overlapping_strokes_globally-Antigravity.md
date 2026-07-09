User request: "commit all changes"

## Objective Reconstruction
The user requested to commit all the current uncommitted changes in the repository, which address multiple UI polish tasks: fixing vector stacked stroke artifacts on translucent icons, resizing utility buttons in the AI assistant sidebar, refining layout constraints, and aligning onboarding headers/notice bubble positions.

## Strategic Reasoning
We resolved multiple vector overlap stroke visual issues across the application by systematically converting translucent text color classes (such as `text-[var(--bone-70)]`, `text-[var(--bone-60)]`, `text-[var(--bone-30)]`) directly applied to Lucide icons into opaque colors (`text-[var(--bone-100)]`) with container-level uniform opacity (e.g. `opacity-70`, `opacity-30`). Additionally, the dimensions and radius of sidebar header utility buttons were enlarged to match the left sidebar's icons, while keeping their stroke weight clean.

## Detailed Blueprint
- **[globals.css](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/app/globals.css)**: Updated the `.btn-sidebar-utility` utility to match the layout button sizing (`w-[26px] h-[26px]` and `rounded-[var(--radius-small)]`).
- **[AIAssistant.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/assistant/AIAssistant.tsx)**: 
  - Adjusted the onboarding temporary chat greeting icon color to opaque white with opacity.
  - Adjusted the temporary chat notice bubble's inset width in sidebar mode.
  - Fixed temporary chat notice bar actions and message bubble icons to use opaque white and opacity.
- **[InstallButton.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/pwa/InstallButton.tsx)**: Optimized the PWA download button colors to avoid vector overlays.
- **[Sidebar.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/layout/Sidebar.tsx)**: 
  - Adjusted sidebar search, toggle, and workspaces/unsorted header icons to use opaque colors and opacity.
- **[HeaderBar.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/layout/HeaderBar.tsx)**: Applied opacity fixes to mobile toggle/search and new tab buttons.
- **[TasksWidget.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/workspace/widgets/TasksWidget.tsx)**, **[SmartTaskStackWidget.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/workspace/widgets/SmartTaskStackWidget.tsx)**, **[ShortcutsWidget.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/workspace/widgets/ShortcutsWidget.tsx)**: Updated widget header buttons to use opaque color + opacity.

## Operational Trace
- Replaced color overrides on Lucide icons.
- Reset the `strokeWidth` parameters in AIAssistant to `2` to sync with the left sidebar's layout.
- Saved all changes.
- Generated this history report.

## Status Assessment
All changes are successfully integrated into the working copy and verified. We are now executing the git stage and commit commands.
