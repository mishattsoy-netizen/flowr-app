User request: "in the canvas preview instead of text preview show canvas preview, can you do that?"

Date/Time: 2026-06-30 21:34

Objective: Replace bullet-point text preview in canvas recents cards with a visual minimap showing canvas blocks scaled to fit the card.

What changed: Added CanvasMiniPreview component to Dashboard.tsx. Each canvas block is rendered as an absolutely-positioned div using its fill color, position, and size, scaled uniformly to a 248x70px viewport. Notes still show bullet lists. Canvases show the minimap.

Status: TypeScript 0 errors, 126/126 tests passing.
