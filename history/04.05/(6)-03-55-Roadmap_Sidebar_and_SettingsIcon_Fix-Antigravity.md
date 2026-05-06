User request: "why is chat is not in the sidebar" & "Settings is not defined"

### Objective Reconstruction
The user reported two issues:
1. The Planning Assistant chat was appearing as a floating box rather than a dedicated right sidebar, and the existing `ActivityLogSidebar` was still rendering in the background.
2. A `ReferenceError` for `SettingsIcon` inside `BotConfigModal.tsx` crashed the Roadmap app.

### Strategic Reasoning
1. **Sidebar Fix:** The global `ActivityLogSidebar` was hardcoded to hide only on the `/admin/bot/brain` route. I needed to extend this exception to `/admin/roadmap` to clear the layout. Then, I needed to convert the `PlanningAssistant`'s container in `RoadmapClient` from a simple flex child into a `fixed` position overlay exactly matching the existing `BrainClient` sidebar pattern.
2. **ReferenceError Fix:** The `BotConfigModal` referenced a custom `SettingsIcon` component that wrapped `Settings` from `lucide-react`, but `Settings` was missing from the import list. Adding the import is the simplest, most robust fix.

### Detailed Blueprint
- `src/components/admin/ActivityLogSidebar.tsx`: Add `/admin/roadmap` to the `pathname` hide list.
- `src/components/admin/roadmap/RoadmapClient.tsx`: Change the assistant container to use `fixed top-0 right-0 h-screen`, and add `paddingRight` dynamic styling to the main layout to offset its width.
- `src/components/admin/roadmap/BotConfigModal.tsx`: Import `Settings` from `lucide-react`.

### Operational Trace
- Edited `ActivityLogSidebar.tsx` to return `null` on `/admin/roadmap`.
- Replaced the flex-box sidebar container in `RoadmapClient.tsx` with a `fixed` absolute sidebar and adjusted the root container's flex properties.
- Edited `BotConfigModal.tsx` to add `Settings` to the import.

### Status Assessment
All issues resolved. The Planning Assistant now functions as a true resizable edge-to-edge right sidebar, identical in feel to the Brain Manager. The application crash caused by the missing `lucide-react` import has been successfully mitigated.
