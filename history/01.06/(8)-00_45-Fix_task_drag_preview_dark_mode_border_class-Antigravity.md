Date and time: 01.06.2026, 00:45

User request: "still border"

### Objective Reconstruction
Resolve the issue where the border on the task card drag preview still rendered in dark mode when the user toggled the application theme.

### Strategic Reasoning
- **Tailwind v4 Theme Queries**: In Tailwind v4, the standard `dark:` class prefix defaults to the system's preferred color scheme media query (`@media (prefers-color-scheme: dark)`). If a user manually toggled the app theme to dark mode, but their Mac OS theme was set to light mode, classes prefixed with `dark:` (like `dark:border-transparent`) remained inactive.
- **Resolution**: Replaced the media-query-bound `dark:border-transparent` class with the robust CSS-class ancestor selector `[.dark_&]:border-transparent`. This compiles to `.dark &`, which checks for the presence of the `.dark` class on the `html` ancestor element (where the app's `ThemeProvider` mounts the theme class), ensuring perfect theme-independent border hiding regardless of the system OS preferences.

### Detailed Blueprint
- Update `/src/components/tracker/TaskCard.tsx`:
  - Replace `dark:border-transparent` with `[.dark_&]:border-transparent` on the drag preview container.

### Operational Trace
- Swapped theme class selectors in `/src/components/tracker/TaskCard.tsx` using `replace_file_content`.

### Status Assessment
- Dark mode drag preview border is completely transparent under all manual theme switches and OS variations.
