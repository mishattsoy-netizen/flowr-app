User request: "there should only be one promt in sys and clas promts no prests or tmplates"

### Objective Reconstruction
The user requested the removal of the preset dropdown selectors from the "System Prompt" and "Classifier Prompt" tabs within the Planning Assistant Config modal. The goal is to simplify the UI to just display the single active prompt text area without any boilerplate templates.

### Strategic Reasoning
1. **Simplifying Configuration:** 
   - The user wishes to maintain a single, canonical system and classifier prompt without relying on hardcoded presets (e.g., "General Planner", "SEO Analyst").
   - By removing the `<select>` dropdowns from `BotConfigModal.tsx`, the UI becomes cleaner and ensures the user directly edits the active database-backed prompt without accidentally overriding it by clicking a preset.

### Detailed Blueprint
- `src/components/admin/roadmap/BotConfigModal.tsx`:
  - Removed the `select` element and its options from the `activeTab === 'prompt'` view.
  - Changed the label text from "Base System Prompt" to "System Prompt".
  - Removed the `select` element and its options from the `activeTab === 'classifier'` view.

### Operational Trace
- Successfully stripped out all template dropdowns from the UI layout.

### Status Assessment
The Bot Config Modal now presents a clean, distraction-free interface containing only the text areas for the System and Classifier prompts.
