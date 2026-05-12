User request: "remove Project Roadmap admin page from the code"

## Date and time of the request
11.05.2026 16:01

## User request
"remove Project Roadmap admin page from the code"

## Objective Reconstruction
Remove all traces of the "Project Roadmap" feature from the admin interface, including its routes, components, and navigation links.

## Strategic Reasoning
The user requested to prune this feature. To do so cleanly, I must remove the page route in `src/app/admin`, the associated UI components in `src/components/admin`, and the navigation entry in the Sidebar to ensure no broken links or dead code remain.

## Detailed Blueprint
- **src/components/admin/Sidebar.tsx**: Removed the "Project Roadmap" link and the `Map` icon.
- **src/app/admin/roadmap/**: Deleted the entire directory containing the page route.
- **src/components/admin/roadmap/**: Deleted the entire directory containing the feature-specific components.

## Operational Trace
- Searched for "roadmap" to identify all dependencies.
- Modified the Sidebar to remove the UI entry.
- Deleted the filesystem directories for both the route and components using PowerShell.

## Status Assessment
- [x] Feature removed successfully.
- [x] Navigation cleaned up.
- [x] Dead code deleted.
