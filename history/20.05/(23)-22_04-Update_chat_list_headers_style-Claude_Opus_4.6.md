User request: "make chat list headers same style as headers in home"

### 0. Date and time of the request
- Date: 20.05
- Time: 22:04

### 1. User request
User request: "make chat list headers same style as headers in home"

### 2. Objective Reconstruction
The user wants to update the design and styling of the chat list group headers (e.g., "Today", "Last 7 days") in the sidebar so they match the visual style of the main file section headers (e.g., "Pinned", "Workspaces").

### 3. Strategic Reasoning
The chat list headers were previously styled with uppercase, smaller font, and a static chevron on the right side. The home/file section headers (like "Pinned") use a more subtle `bone-30` color, non-uppercase text, and group the text and chevron closely together on the left, where the chevron only appears on hover. By updating the chat headers to use this exact same DOM structure and utility classes, we ensure visual consistency across the entire sidebar.

### 4. Detailed Blueprint
- Locate the chat history section rendering in `Sidebar.tsx`.
- Update the HTML structure of the chat group headers to match the `Pinned` header.
- Remove uppercase styling, change font size and color to match.
- Move the chevron next to the label and apply the opacity/hover transition logic.

### 5. Operational Trace
- Edited `/Users/mktsoy/Dev/flowr-4-main/src/components/layout/Sidebar.tsx` to replace the chat list header block with the new styles.

### 6. Status Assessment
The chat list headers now perfectly match the styling of the other sidebar section headers. The update was successfully applied.
