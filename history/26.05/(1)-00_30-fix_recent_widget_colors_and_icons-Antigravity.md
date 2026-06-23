User request: "fix recent widget colors"

### 0. Date and time of the request
2026-05-26 00:27:55 (Local time)

### 1. User request
"fix recent widget colors"

### 2. Objective Reconstruction
The user requested a fix for the dashboard's "Recent" widget colors. Upon inspecting the screenshot and codebase, several bugs were identified:
1. **Background Color Inconsistency**: The stacked widget background was rendered as `bg-sidebar` (darker gray `#1E1E1D`), making stacked panels look darker and completely inconsistent with other dashboard widgets which use `bg-panel` (panel gray `#262626`).
2. **Invalid Color Variables**: The Recent and All Files widgets used invalid tailwind colors like `var(--bone-60)` and `var(--bone-40)` which aren't defined in the stylesheet, resulting in unstyled/broken colors for folder icons and time metadata.
3. **Incorrect Folder Icon Mapping**: All items in the Recent list defaulted to folder icons because `getEntityIcon` returns a folder for undefined icon strings, regardless of whether the underlying item is a note, canvas, or mixed entity.

### 3. Strategic Reasoning
1. **Unify Stacked Background**: Changed `bg-sidebar` to `bg-panel` inside `GenericStackedWidget.tsx` to unify it with all other dashboard cards and prevent inconsistent dark backgrounds.
2. **Replace Invalid Colors**: Replaced the undefined `var(--bone-60)` and `var(--bone-40)` variables with the standard, fully supported `--bone-30` opacity color, which renders a clean, subtle gray for metadata and default icon states.
3. **Correct Default Icons**: Updated the icon resolver in both the Recent list and All Files list to map notes, canvases, and mixed items to their respective Lucide icons (`FileText`, `Frame`, `Layers`) rather than rendering folder icons everywhere.

### 4. Detailed Blueprint
- **Files modified**:
  1. [GenericStackedWidget.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/workspace/widgets/GenericStackedWidget.tsx)
  2. [RecentWidget.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/workspace/widgets/RecentWidget.tsx)
  3. [AllFilesWidget.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/workspace/widgets/AllFilesWidget.tsx)
- **Modifications**:
  - `GenericStackedWidget.tsx`: Change class `bg-sidebar` to `bg-panel`.
  - `RecentWidget.tsx`: Import default type icons, add default fallback mapping for notes/canvases/mixed entities, and replace invalid `--bone-60` and `--bone-40` with `--bone-30`.
  - `AllFilesWidget.tsx`: Add similar default type icon mapping and replace invalid `--bone-40` with `--bone-30`.

### 5. Operational Trace
- Modified `GenericStackedWidget.tsx` using `replace_file_content` to fix the background color.
- Modified `RecentWidget.tsx` using `multi_replace_file_content` to fix invalid text colors and default icon fallbacks.
- Modified `AllFilesWidget.tsx` using `multi_replace_file_content` to fix invalid text colors and default icon fallbacks.

### 6. Status Assessment
- **Status**: Completed.
- **Fixed**: Stacked widgets are visually consistent, default file types show correct documents/canvases/layers icons instead of generic folder icons, and colors resolve beautifully.
