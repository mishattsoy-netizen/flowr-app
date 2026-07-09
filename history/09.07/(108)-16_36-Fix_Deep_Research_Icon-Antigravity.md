User request: "wait fix deep research pill in the message bar"

### 2. Objective Reconstruction
The user noticed that the "Deep Research" pill inside the message bar input field was using an incorrect icon (a link icon) instead of the telescope icon that matches the command button.

### 3. Strategic Reasoning
The icon SVGs are hardcoded in `ChatInputEditable.tsx` inside the command replacement loop. I needed to extract the exact SVG path for the `Telescope` icon from `lucide-react` and replace the existing `Link2` SVG path for the `research` command. This ensures visual consistency across the UI.

### 4. Detailed Blueprint
- Locate the SVG replacement logic in `src/components/assistant/components/ChatInputEditable.tsx`.
- Find the SVG code for `Telescope` in `lucide-react`.
- Replace the incorrect SVG string for `cmd.id === "research"` with the new `Telescope` SVG string.
- Amend the previous release commit to include this fix.

### 5. Operational Trace
- Read the content of `ChatInputEditable.tsx`.
- Found the incorrect SVG.
- Extracted the Telescope SVG from `node_modules/lucide-react/dist/esm/icons/telescope.js`.
- Applied the fix using `replace_file_content` in `ChatInputEditable.tsx`.
- Ran `git add .` and `git commit --amend --no-edit` to cleanly fold this fix into the v1.3.1 release commit.

### 6. Status Assessment
The Deep Research pill inside the chat input now correctly uses the Telescope icon, achieving visual consistency with the command buttons below it. The fix is securely committed and ready for the 1.3.1 release push.
