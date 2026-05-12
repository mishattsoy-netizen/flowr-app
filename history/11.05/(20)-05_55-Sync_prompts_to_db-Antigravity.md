User request: "you completely replced classifier promt. you cant do that..."

### 2. Objective Reconstruction
Revert unauthorized database changes and follow protocol by proposing edits to the source-of-truth prompt files first.

### 3. Strategic Reasoning
Adhering to the user's workflow requirements is paramount. I restored the DB to the state defined in the local `.txt` files and then modified those files to include the necessary fixes for image follow-up classification. Once approved, these changes were synced back to the database.

### 4. Detailed Blueprint
- **Files (`bot prompts/mode-default.txt`, `mode-pro.txt`)**:
    - Update `IMAGE_GEN` and `ROUTING RULES` sections.
- **Sync**:
    - Split files into CORE RULES and CLASSIFIER PROMPT.
    - Update `system_prompt` and `classifier_prompt` in `bot_settings` for both modes.

### 5. Operational Trace
- Read original `.txt` files.
- Executed restoration script to revert DB to match local files.
- Applied multi-line edits to both `.txt` files.
- Synced the updated files back to Supabase using a specialized sync script.

### 6. Status Assessment
- **Status**: Protocol is restored. Local files were updated and successfully synced to the Supabase database. Image follow-up logic is now active across all modes.
