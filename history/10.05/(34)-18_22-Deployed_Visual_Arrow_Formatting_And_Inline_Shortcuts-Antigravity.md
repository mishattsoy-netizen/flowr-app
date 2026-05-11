User request: "add ability for bot to use custom arrows as formatting elements in chat, and create a shortucs for them so i can use them in notes, for example -> creates arrow --> creates longer arrow, or /arrowdown creates arrown down"

## 1. Objective Reconstruction
Deploy advanced typographical rendering and operational shorthand for specialized arrow indicators. Features include: (1) Automatic conversion of textual arrow glyphs (`->`, `/arrowdown`, etc.) within Chat output into elegant, rich aesthetic inline elements, and (2) Real-time autocorrect shortcuts enabling frictionless insertion of equivalent Unicode representations directly into the active contentEditable flow within the Notes subsystem.

## 2. Strategic Reasoning
The architecture implements two specialized tracks mirroring the user’s conceptual split: 
1. **Chat Track**: Visual enrichment. By recursing into dynamic Markdown renderers, I apply inline JSX `<span>` substitutions to raw string text, elevating the aesthetic (rich scale, accent weight) without altering the latent data.
2. **Editor Track**: Structural efficiency. I designed a range interceptor utilizing `window.getSelection()` and native `document.execCommand('insertText')` routines. When the user hits the activation key (Space), the engine dynamically scans for token suffixes, targets them with atomic node ranges, and rewrites them in the DOM history stack, ensuring perfect preservation of the Undo/Redo chain while delivering an ultra-clean user-typing experience.

## 3. Detailed Blueprint
- **ChatMessage.tsx**: 
    - Created dictionary `ARROW_MAP`.
    - Implemented `renderContentWithArrows` utility logic recursive engine.
    - Wrapped text children of `p`, `h1`, `h2`, `h3`, and `li`.
- **BlockRenderer.tsx**: 
    - Inserted an atomic range scanner to `handleKeyDown`'s space listener.
    - Added immediate node rewrite logic leveraging the standard DOM edit context.

## 4. Operational Trace
- Modified `ChatMessage.tsx`: Introduced the mapping engine and mapped 11 key trigger strings to high-def JSX inline elements.
- Modified `BlockRenderer.tsx`: Deployed the `Range.setStart/setEnd` manipulation cascade directly preceding native key propagates.

## 5. Status Assessment
Full feature cycle completed. Bot responses now automatically visually emphasize directionals, and user text fields natively facilitate ultra-fast directional shortcuts mirroring modern high-end design tools.
