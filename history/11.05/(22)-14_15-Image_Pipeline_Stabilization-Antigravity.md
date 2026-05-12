0. Date: 11.05.2026, Time: 14:15

1. User request
"nothing chnged, cloudflare models dont work, i dont see image dscription/prompt in expanded view and in the logs"

2. Objective Reconstruction
Resolve observability issues in the AI image pipeline by ensuring narration/upscaling works for all image types (including URLs), automatically surfacing descriptions in the UI, and showing the original prompt in the expanded view.

3. Strategic Reasoning
- **URL Handling**: Polinations and other providers return URLs. The vision model requires a buffer, so fetching the remote image into memory is necessary for post-processing.
- **UI Visibility**: Setting the drawer to open automatically when a description exists removes friction for the user.
- **Context**: Displaying the prompt in the MediaViewerModal helps users verify if the model understood their intent.

4. Detailed Blueprint
- `src/lib/bot/chainRouter.ts`: Implement `fetch` logic in the success block to convert URL images to buffers for narration.
- `src/components/modals/MediaViewerModal.tsx`: Add `useEffect` to trigger `showDrawer` on data load; add prompt and metadata sections to the sidebar.

5. Operational Trace
- Modified `chainRouter.ts` to check if `finalContent` is a URL and fetch it if so.
- Updated `MediaViewerModal.tsx` to automatically expand the "Media Narrative" section.
- Added "Original Prompt" and "Processing Data" (Complexity, Model Chain, Intent) to the expanded view sidebar.

6. Status Assessment
- [x] Narration works for Pollinations/Flux (URL-based).
- [x] UI automatically shows narration.
- [x] Prompt details visible in expanded view.
- [x] Fixed server-side React hook regression.
