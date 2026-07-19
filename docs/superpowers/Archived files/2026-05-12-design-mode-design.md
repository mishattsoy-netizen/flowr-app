# Design Mode — Design Spec
**Date:** 2026-05-12
**Status:** Ready for planning

---

## Overview

Design Mode lets users ask the bot to generate live, interactive visual components — charts, cards, progress bars, tables, buttons, graphs — directly in the chat. Components render as real interactive React elements in the chat message. The user can then add any component to a note page as a new `design` block type, where it continues to render and remain interactive.

---

## Scope

**In scope:**
- Design Mode toggle in the `+` popup
- Bot generates a component spec (structured JSON) when Design Mode is active
- Frontend renders the spec as a live React component inside `ChatMessage`
- "Add to Note" button on each design component
- New `design` block type in the note editor — stores spec JSON, renders live
- Supported component types: bar chart, line chart, pie chart, card, progress bar, data table, button group, stat block
- Component data is provided inline in the spec (user supplies data in their prompt)

**Out of scope:**
- Components that fetch live external data (that's Extensions territory)
- Custom component code execution (no arbitrary JS eval)
- Export to image / PDF
- Collaborative real-time editing of design blocks

---

## How It Works — End to End

```
1. User enables Design Mode toggle (+ popup)
2. User types: "Create a bar chart showing Jan 120, Feb 95, Mar 140"
3. Request reaches /api/ai/chat with mode flag: designMode: true
4. Bot responds with natural language + a structured JSON block:
   {
     "design": {
       "type": "bar_chart",
       "title": "Monthly Values",
       "data": [
         { "label": "Jan", "value": 120 },
         { "label": "Feb", "value": 95 },
         { "label": "Mar", "value": 140 }
       ],
       "color": "#E09952"
     }
   }
5. ChatMessage detects the design block, renders <DesignComponent spec={...} />
6. User sees a live interactive bar chart in the chat
7. User clicks "Add to Note" → selects a note → block is added to the note
8. In the note editor, the design block renders <DesignComponent spec={...} /> identically
```

---

## Component Spec Format

All design components share a common JSON envelope:

```ts
interface DesignSpec {
  type: DesignComponentType;
  title?: string;
  description?: string;
  color?: string;         // primary accent color (hex)
  theme?: 'auto';         // always 'auto' — matches app theme
  data?: any;             // type-specific data payload
  config?: any;           // type-specific config options
}

type DesignComponentType =
  | 'bar_chart'
  | 'line_chart'
  | 'pie_chart'
  | 'card'
  | 'progress_bar'
  | 'data_table'
  | 'button_group'
  | 'stat_block';
```

### Type-specific data schemas

**bar_chart / line_chart:**
```json
{
  "type": "bar_chart",
  "title": "Monthly Sales",
  "data": [{ "label": "Jan", "value": 120 }, { "label": "Feb", "value": 95 }],
  "config": { "yAxisLabel": "Units", "showGrid": true }
}
```

**pie_chart:**
```json
{
  "type": "pie_chart",
  "title": "Budget Split",
  "data": [{ "label": "Design", "value": 40 }, { "label": "Dev", "value": 60 }]
}
```

**card:**
```json
{
  "type": "card",
  "title": "Project Status",
  "description": "On track for Q2 deadline",
  "data": { "badge": "On Track", "badgeColor": "#22C55E", "details": ["Owner: Misha", "Due: June 30"] }
}
```

**progress_bar:**
```json
{
  "type": "progress_bar",
  "title": "Completion",
  "data": [
    { "label": "Design", "value": 80, "max": 100 },
    { "label": "Dev", "value": 45, "max": 100 }
  ]
}
```

**data_table:**
```json
{
  "type": "data_table",
  "title": "Q1 Results",
  "data": {
    "columns": ["Month", "Revenue", "Users"],
    "rows": [["Jan", "$12k", "340"], ["Feb", "$9.5k", "280"]]
  }
}
```

**stat_block:**
```json
{
  "type": "stat_block",
  "data": [
    { "label": "Total Users", "value": "1,240", "trend": "+12%" },
    { "label": "Revenue", "value": "$48k", "trend": "+5%" }
  ]
}
```

**button_group:**
```json
{
  "type": "button_group",
  "data": [
    { "label": "Approve", "variant": "primary" },
    { "label": "Request Changes", "variant": "secondary" },
    { "label": "Reject", "variant": "danger" }
  ]
}
```

---

## Frontend Architecture

### `DesignComponent` (`src/components/design/DesignComponent.tsx`)

A renderer that takes a `DesignSpec` and dispatches to the correct sub-renderer:

```ts
interface DesignComponentProps {
  spec: DesignSpec;
  onAddToNote?: () => void;  // undefined = don't show the button (note context)
}
```

Sub-renderers live in `src/components/design/renderers/`:
- `BarChartRenderer.tsx` — uses Recharts `BarChart`
- `LineChartRenderer.tsx` — uses Recharts `LineChart`
- `PieChartRenderer.tsx` — uses Recharts `PieChart`
- `CardRenderer.tsx` — pure Tailwind card
- `ProgressBarRenderer.tsx` — animated CSS progress bars
- `DataTableRenderer.tsx` — styled HTML table
- `ButtonGroupRenderer.tsx` — button row (buttons are visual only — they have no actions in this spec)
- `StatBlockRenderer.tsx` — metric tiles with trend indicators

Recharts is already in the dependency tree (used in admin analytics). No new chart library needed.

### `DesignComponentWrapper` (`src/components/design/DesignComponentWrapper.tsx`)

Wraps `DesignComponent` in chat context — adds the "Add to Note" button and a component type label:

```
┌─────────────────────────────────────────────┐
│ ▦ Bar Chart · Monthly Sales                 │
│                                             │
│  [rendered Recharts bar chart]              │
│                                             │
│              [+ Add to Note ↓]             │
└─────────────────────────────────────────────┘
```

"Add to Note" opens a note picker (existing `PathPicker` component) → inserts a `design` block at the end of the selected note.

### Integration with `ChatMessage`

In `src/components/assistant/components/ChatMessage.tsx`, after rendering the message text content, detect a design spec in the message and render the wrapper:

```tsx
{msg.designSpec && (
  <DesignComponentWrapper
    spec={msg.designSpec}
    onAddToNote={() => openNotePicker(msg.designSpec!)}
  />
)}
```

`designSpec` is added to the `AIMessage` interface in `store.types.ts`.

---

## API — Design Mode Flag

In `/api/ai/chat`, when `designMode: true` is in the request body, a design-mode instruction is prepended to the system prompt:

```
[DESIGN MODE ACTIVE]
When the user asks you to create a visual, chart, card, or component,
respond with your natural language explanation AND a JSON block using this schema:

{"design": { "type": "...", "title": "...", "data": {...}, "config": {...} }}

Supported types: bar_chart, line_chart, pie_chart, card, progress_bar,
data_table, button_group, stat_block.

Only include the design JSON when explicitly creating a visual.
For normal conversation, respond as usual.
```

The bot's response is parsed server-side (or client-side on stream completion) to extract the `design` JSON block from the message content. The JSON block is stripped from the displayed text and surfaced as `designSpec` on the message object.

---

## Note Editor — `design` Block Type

### Block type registration

Add `'design'` to the `BlockType` union in `src/data/store.types.ts`:
```ts
export type BlockType = 'text' | 'heading' | 'image' | 'code' | ... | 'design';
```

The `EditorBlock` interface gains an optional field:
```ts
designSpec?: DesignSpec;
```

### Rendering in the note editor

In the block renderer (wherever `EditorBlock` types are switched on), add:
```tsx
case 'design':
  return (
    <DesignComponent
      spec={block.designSpec!}
      onAddToNote={undefined}  // no "Add to Note" button inside a note
    />
  );
```

### Inserting a design block from chat

When "Add to Note" is clicked:
1. `PathPicker` opens — user selects a note entity
2. A new `EditorBlock` of type `design` is appended to that note's `blocks` array via the existing `updateEntityContent` store action
3. Toast: "Added to [Note title]"

---

## `AIMessage` Type Update

In `src/data/store.types.ts`, add to `AIMessage`:
```ts
  designSpec?: import('@/components/design/DesignComponent').DesignSpec;
```

---

## Design Mode State

In the Zustand store, add:
```ts
designModeEnabled: boolean;
setDesignModeEnabled: (enabled: boolean) => void;
```

Initial value: `false`. The `+` popup toggle reads/writes this. When `designModeEnabled` is true, the `sendAIMessage` action includes `designMode: true` in the API request body.

---

## Error Handling

- Bot returns malformed or missing design JSON: render the text response as-is, no component shown
- Unknown `type` value: render a fallback "Unsupported component type: X" placeholder card
- Recharts render error: catch with React error boundary per component, show "Could not render [type]" message
- Note insert failure: show toast error, design spec not lost (still in chat message)

---

## Spec JSON Parse Location

Parse the design JSON **client-side on stream completion** (not server-side). After the SSE stream ends, the store scans the final `accumulatedContent` for a `{"design":{...}}` block using a regex, extracts it, and sets `designSpec` on the message. The raw JSON block is removed from the displayed `content` string.

Pattern to extract (captures the full outer object including the `"design"` key):
```ts
const DESIGN_BLOCK_RE = /\{"design"\s*:\s*(\{[\s\S]*?\})\}/;
// Group 1 is the inner DesignSpec object.
// Full match is removed from displayed content; group 1 is JSON.parsed as DesignSpec.
```

This keeps the API route unchanged and places all parsing logic in the store's `sendAIMessage` action.
