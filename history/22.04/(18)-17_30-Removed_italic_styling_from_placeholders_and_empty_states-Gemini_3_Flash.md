User request: "dont use italic font style for placehders"

### 2. Objective Reconstruction
Standardize the typography of empty states and placeholders by removing the `italic` font style globally. This applies to dashboard widgets, search results, and menu placeholders.

### 3. Strategic Reasoning
Italic placeholders are a common legacy design pattern but can sometimes look cluttered or inconsistent in high-density, modern interfaces. By reverting to standard font styling, we achieve a cleaner, more stable look that aligns with the project's monochromatic and professional design goals.

### 4. Detailed Blueprint
- **Dashboard Widgets**: Updated `TasksWidget`, `SmartTaskStackWidget`, `ShortcutsWidget`, `RecentWidget`, `QuickLinksWidget`, `FoldersWidget`, and `AllFilesWidget`.
- **Layout Components**: Updated `Sidebar` (search results) and `PathPicker`.
- **Editor UI**: Updated `BlockOptionsMenu` (empty search state).

### 5. Operational Trace
- Performed a codebase-wide grep for `italic`.
- Identified 10 key locations where empty states were styled with italics.
- Successively applied `multi_replace_file_content` to remove the utility class from each file.

### 6. Status Assessment
Completed. All empty states and placeholders now use standard font-style.
