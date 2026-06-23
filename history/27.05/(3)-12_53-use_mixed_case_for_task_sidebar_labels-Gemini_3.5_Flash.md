User request: "dont use all capital letters"

# History Report: Use Mixed Case for Task Sidebar Labels

### 0. Date and Time of the Request
- Date: May 27, 2026
- Completion Time: 12:53 PM

### 1. User Request
User request: "dont use all capital letters"

### 2. Objective Reconstruction
- Change all capitalized headers and property key labels in the task details sidebar drawer to standard mixed-case capitalization (e.g., "Status" instead of "STATUS").
- Format the segmented priority/status buttons to use standard mixed-case capitalized typography for a cleaner, modern look.

### 3. Strategic Reasoning
- Upper-case text can sometimes feel shouting or heavy. Mixed-case formatting in sidebar key labels contributes to a lighter, cleaner interface design that matches standard modern design rules.
- Removing `uppercase` and `tracking-wider` styling and replacing them with standard typography ensures visual harmony with the rest of the application.

### 4. Detailed Blueprint
- **`src/components/modals/NewTaskModal.tsx`**:
  - Remove `uppercase tracking-wider` and standardise key labels: Status, Priority, Due Date, Workspace, Color Tag, Description, and Subtasks.
  - Format Priority button labels to capitalize case.
  - Remove `uppercase` from Completed status button label to preserve mixed-case formatting.

### 5. Operational Trace
1. **Refactored Typography Classes**:
   Replaced all occurrences of `uppercase` classes on properties grid keys and sidebar header labels in `NewTaskModal.tsx` with standard typography sizes.
2. **Type Checking Verification**:
   Ran `npx tsc --noEmit` and verified compilation is completely clear.

### 6. Status Assessment
- **Status**: Completed. All labels in the details sidebar drawer render beautifully in standard mixed-case letters, providing a visually premium and modern feel.
