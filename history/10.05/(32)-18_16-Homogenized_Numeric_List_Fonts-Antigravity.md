User request: "list number must be same size and font syle as list text"

## 1. Objective Reconstruction
Eradicate typographic mismatch in numeric lists. Normalize the generated ordinal string styling to conform exactly with the surrounding textual context in weight, size, and font family.

## 2. Strategic Reasoning
Historically, the editor used a separate `font-mono` and reduced `text-[0.95rem]` definition to render list enumerators. By manually overwriting these specific tokens with the explicit values leveraged by body text (`font-display` and `text-[19px]`), we achieve perfect continuous rhythm between the marker and its associated entry text. Verified that Assistant Markdown structures are already force-synced utilizing `Crimson Text`.

## 3. Detailed Blueprint
- **BlockRenderer.tsx**: Update the return vector for `numberedList` to scrub all code-font overrides and insert explicit body text classes.

## 4. Operational Trace
- Modified `BlockRenderer.tsx`:
    - Traded `font-mono` for `font-display`.
    - Removed `tabular-nums` density overrides.
    - Realigned size constraint to literal `text-[19px]`.

## 5. Status Assessment
List markers and content text completely synchronized. Both fonts and pixel measurements match natively across the Notes topology.
