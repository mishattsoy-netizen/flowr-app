User request: "use bone 60 for all bullets and list numbers in the chat and note"

## 1. Objective Reconstruction
Implement consistent global overrides to list marker color tokens. Align the Assistant window's markdown renderer and the active Notes block renderer to universally utilize `var(--bone-60)` for numeric strings, dashes, and bullet vectors.

## 2. Strategic Reasoning
The requested change mandates high-fidelity parity across disparate UI render stacks. By iterating through the specific Tailwind token mappings and absolute background variables controlling those markers, I replaced explicit references to the active accent color with the prescribed brand token to lower general UI noise as requested.

## 3. Detailed Blueprint
- **BlockRenderer.tsx**: Map background colors for bullets/dashes and text colors for Numbers from dynamic accent/muted cascades into explicit `var(--bone-60)` strings.
- **ChatMessage.tsx**: Override `ol` Tailwind marker utility and standard unordered `span` inline-dot styles to reference `text-bone-60`.

## 4. Operational Trace
- Modified `BlockRenderer.tsx`: Updated the sequential `listMarker` conditional branches to use strict `bone-60` CSS variable background & text tokens.
- Modified `ChatMessage.tsx`: Located and updated the React-Markdown handlers for `<ol>` and raw `<li>` bullets, replacing `text-accent` with `text-bone-60`.

## 5. Status Assessment
Uniform visual sync completed. List enumeration and markers are now consistently rendered in high-legibility `--bone-60` across both active surfaces.
