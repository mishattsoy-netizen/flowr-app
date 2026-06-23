User request: "fix bg color of slider(nav, stacked and smart tasks). fix my message bubble bg"

## 0. Date and time of the request
21.05 15:32

## 1. User request
User request: "fix bg color of slider(nav, stacked and smart tasks). fix my message bubble bg"

## 2. Objective Reconstruction
The user noticed that the active slider "pill" backgrounds in the Sidebar Navigation, Stacked Tasks widget, and Smart Tasks widget, as well as the background of the user's message bubble in the AI assistant chat, were invisible or poorly contrasted in light mode. The objective was to replace hardcoded colors (like `bg-white/[0.08]` and `#121212`) with theme-aware variables.

## 3. Strategic Reasoning
The previous hardcoded values worked well for dark mode but were either invisible or jarring in light mode. By switching these specific elements to use `var(--app-dark)` (which is a light grey `#EBEBE6` in light mode and deep dark `#121212` in dark mode), we achieve perfect contrast against the `#FFFFFF` and `#FDFDF7` backgrounds respectively, preserving the aesthetic in both themes.

## 4. Detailed Blueprint
- `Sidebar.tsx`: Change nav slider pill from `bg-white/[0.08]` to `bg-[var(--app-dark)]`.
- `SmartTaskStackWidget.tsx`: Change smart tasks slider pill from `bg-[var(--bone-10)]` to `bg-[var(--app-dark)]`.
- `GenericStackedWidget.tsx`: Change stacked tasks slider pill from `bg-[var(--bone-10)]` to `bg-[var(--app-dark)]`.
- `ChatMessage.tsx`: Change the user message bubble background from `#121212` to `var(--app-dark)` and enforce `text-[var(--bone-100)]` text color for contrast.

## 5. Operational Trace
- Replaced `bg-white/[0.08]` with `bg-[var(--app-dark)]` in `Sidebar.tsx`.
- Replaced `bg-[var(--bone-10)]` with `bg-[var(--app-dark)]` in `SmartTaskStackWidget.tsx`.
- Replaced `backgroundColor: '#121212'` with `backgroundColor: 'var(--app-dark)'` in `ChatMessage.tsx` along with adding `text-[var(--bone-100)]` for proper text color.
- Replaced `bg-[var(--bone-10)]` with `bg-[var(--app-dark)]` in `GenericStackedWidget.tsx`.

## 6. Status Assessment
The slider pill backgrounds across the navigation and widgets are now fully theme-aware and visible in both light and dark modes. The user's message bubble in the AI Assistant chat also correctly adapts to the active theme. No edge cases detected.
