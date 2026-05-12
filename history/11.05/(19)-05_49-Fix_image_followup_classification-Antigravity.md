User request: (Follow-up image request failing with "[Image Data]" response)

### 2. Objective Reconstruction
Resolve context loss and misclassification for image follow-up requests. Ensure that the bot understands when a user wants to modify or iterate on a previously generated image.

### 3. Strategic Reasoning
The failure had two components:
1. **Misclassification**: The classifier prompt was too strict and didn't explicitly instruct models to treat follow-ups (e.g., "make him...") as `IMAGE_GEN`. This resulted in the request being routed to a text model (`MEDIUM_THINKING`).
2. **Hallucination**: Because the history used the placeholder `[Image Data]` for previous images, text models were mimicking this format as a literal response instead of explaining they couldn't generate images. 
3. **Context Gap**: My previous fix for `image_description` provides the necessary visual context, but the classifier needed to be told to look for it.

### 4. Detailed Blueprint
- **Database (`bot_settings`)**:
    - Update `classifier_prompt` for the `default` mode.
    - Add explicit rules for `IMAGE_GEN` follow-ups and reference resolution using history.
- **File (`src/lib/bot/memory.ts`)**:
    - Replace the generic `[Image Data]` placeholder with `[Image: (visual content generated)]`.
    - This breaks the "copy-paste" loop where models think they should output `[Image Data]`.

### 5. Operational Trace
- **Updated Classifier**: Wrote and executed a script to patch the `classifier_prompt` in Supabase with refined logic for image iteration.
- **Improved Memory Formatting**: Modified `memory.ts` to use more descriptive placeholders for images lacking a specific narration.
- **Verified Pipeline**: Confirmed that the `expandImagePrompt` logic is already equipped to resolve "him", "her", "that" once the classification is corrected.

### 6. Status Assessment
- **Completed**: Follow-up image requests should now correctly trigger the image generation pipeline.
- **Completed**: Text models are less likely to respond with confusing `[Image Data]` placeholders.
- **Next**: The user should try a follow-up like "make him dance with Padme" now.
