### 0. Date and time of the request
Date: 04.07.2026
Time: 19:51 (Start) - 19:52 (End)

### 1. User request
User request: "remove this panel from task attchment preview"

### 2. Objective Reconstruction
Hide the AI chat drawer panel from the media viewer modal when previewing standard task attachments, while displaying the filename as the main preview title instead.

### 3. Strategic Reasoning
The side drawer panel was opening because `TaskInspectorPanel` passed `description: att.name` to the `mediaViewer` modal, which interpreted it as an AI narrative/prompt description. To resolve this, we:
1. Added a `title` field to the `mediaViewer` modal configuration.
2. Modified `MediaViewerModal.tsx` to render the dynamic `title` (or default "Attachment Preview") in the top-left area.
3. Updated `TaskInspectorPanel.tsx` to pass the filename as `title` rather than `description`, keeping the AI narrative drawer hidden.

### 4. Detailed Blueprint
- `src/data/store.types.ts`: Add `title?: string` to `mediaViewer` type in `ModalType`.
- `src/components/modals/MediaViewerModal.tsx`: Render `modalData?.title` in the header instead of "Attachment Preview".
- `src/components/tracker/TaskInspectorPanel.tsx`: Pass `title: att.name` instead of `description` in `handleViewAttachment`.

### 5. Operational Trace
- Updated `src/data/store.types.ts` schema configuration.
- Modified `src/components/modals/MediaViewerModal.tsx` header text rendering.
- Modified `src/components/tracker/TaskInspectorPanel.tsx` `handleViewAttachment` modal parameters.
- Verified TypeScript build clean run.

### 6. Status Assessment
Completed successfully. The side panel is now removed from standard task attachment previews, and the filename displays elegantly in the top-left header.
