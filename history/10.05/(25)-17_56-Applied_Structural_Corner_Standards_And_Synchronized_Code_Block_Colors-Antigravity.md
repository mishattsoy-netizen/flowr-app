User request: "use 16px coener in chat and 24px corners in notes for database, simple tables, Media blocks, code block, embed blocks... and code block and tables must have same colors, ue tables colors as default"

## 1. Objective Reconstruction
Introduce global dimensional consistency across all major structural elements by defining strict corner radius thresholds: 24px within the Note Workspace and 16px within the conversational AI Assistant interface. Concurrently, unify visual theming for Code Blocks and Tables by stripping independent Code color overrides and enforcing direct adoption of each habitat's active Table defaults.

## 2. Strategic Reasoning
- **Layout Hardening**: By explicitly targeting `rounded-3xl` for the Note system and defining standard `--radius-3xl` strictly as `24px` in `globals.css`, we allow robust scaling for heavy interface elements like Tables and Databases without corrupting dashboard-wide global tokens like `radius-big`.
- **Thematic Unity**: Harmonizing visual backgrounds for Code and Tables creates clear gestalt grouping: both components represent data/structural outputs. Applying the local "Table Background" to Code instances natively preserves appropriate depth in both the darker notes field (`bg-white/[0.02]`) and chat dialogue bubble environment (`bg-black/10`).

## 3. Detailed Blueprint
- **Token Definition**: Re-bind `--radius-3xl` to explicitly `24px` in `src/app/globals.css`.
- **Notes (24px Corner Upgrades)**: Target Database wraps, Table grids, Image containers, Embed slots, and Mono wrapper declarations in `BlockRenderer.tsx` to consume the `rounded-3xl` attribute.
- **Note Colors**: Replace hardcoded `#0e0e0e` Mono style definition with table fallback `bg-white/[0.02]`.
- **Chat (16px Corner Upgrades)**: Overwrite standard `rounded-xl` (12px) bindings in `ChatMessage.tsx` and `ChatImage.tsx` with `rounded-2xl` (16px) across Tables, Code segments, and generated Media frames.
- **Chat Colors**: Shift Chat Code background from generic dark to synced `bg-black/10` mirroring dynamic text tables.

## 4. Operational Trace
- Modified `src/app/globals.css`: Swapped `--radius-3xl` variable mapping from `var(--radius-big)` to strict `24px`.
- Modified `src/components/editor/BlockRenderer.tsx`:
    - Remapped core container wrappers for `database`, `table`, `image/video`, `embed`, and `mono` selection logic from medium/variable tokens to unified `rounded-3xl`.
    - Substituted internal `mono` rendering case with generic Table specifications: `bg-white/[0.02]` and `border-white/10`.
- Modified `src/components/assistant/components/ChatMessage.tsx`: Upgraded dynamic markdown rendering blocks for `table` and `code` from `rounded-xl` to `rounded-2xl`. Transposed code background override to `bg-black/10`.
- Modified `src/components/assistant/components/ChatImage.tsx`: Repurposed primary image frame with `rounded-2xl`.

## 5. Status Assessment
Task executed with zero drift. The architectural elements across both core domains are now visually locked to the explicit corner mandates and unified thematic guidelines.
