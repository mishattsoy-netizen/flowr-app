# Brand, Vibe & Style System

The website is a direct extension of the app's visual DNA (see `DESIGN.md` in repo root). App and site must be indistinguishable in feel — that continuity is itself a quality signal.

**Vibe in five words:** editorial, warm, calm, precise, personal.
**Reference sites the owner likes:** Notion, Revolut, Claude (claude.com / anthropic.com).

---

## 1. Voice & copy rules

- Short declarative serif headlines. Plain-spoken body copy.
- **Banned words:** revolutionary, supercharge, 10x, unleash, game-changing, blazing, seamless(ly) as hype. No exclamation marks in headlines.
- Confident understatement (Anthropic/Notion school).
- **Beta honesty is part of the brand:** "Flowr is in beta. It's already good. It's getting better every week."
- Founder notes signed **— Mikhail** (never "Misha").
- The AI's Telegram connector is a quiet power feature mentioned in lists — never headline copy.

## 2. Color roles (strict)

| Role | Value | Usage |
|---|---|---|
| Background | `#1b1b1a` (dark-first) / `#ebebeb` light | Page canvas. Dark is the default presentation. |
| Panels/cards | `#2A2A28` + bone translucency overlays | Glass panels, screenshot frames |
| Text | bone `#eeeee8` / `#242423` | Primary text |
| Dim text | bone at 60% | Secondary text, captions, mono labels |
| **Brand blue `#2A78D6`** | The **importance accent** | Primary CTAs (Download free), key highlighted elements, active vote state, link hovers |
| **Orange `#e48921`** | The **art accent — exclusively** | ONLY as the single filled shape inside hand-drawn illustrations, or one rare emphasis (e.g. Beta badge). **Never on buttons or UI controls.** |
| Danger `#ff6060` | rare | Only if ever needed (form errors) |

**Regular buttons are monochrome** — bone-on-charcoal / charcoal-on-bone, like the app. Blue is reserved for the few "act here" moments: **at most one blue element per viewport, not counting the persistent nav's Download button.** Hierarchy: **blue = act here, orange = the art is alive, everything else stays quiet.**

Translucent "bone" overlay steps (2/3/5/6/10/12/15/30/40/70/90/100%) come straight from the app's `globals.css` — the site imports these tokens, never redefines them. NOTE: the bone scale has gaps (no 8/20/40-light etc.) — verify a token exists before using it.

## 3. Typography

| Face | Role | Notes |
|---|---|---|
| **Libertinus Serif** | Display: headlines, editorial passages, big statements | The app's current `--font-display`. NOT Crimson Pro (deprecated). |
| **DM Sans** | UI/body: buttons, nav, body copy, cards | Letter-spacing per app conventions |
| **DM Mono** | Data: prices, versions, dates, file sizes, keyboard keys, small print like `macOS · Windows · Free · Beta` | weight 500, letter-spacing 0 |

Headline scale is generous and editorial — hero statements can be 64–96px on desktop. Serif headlines use the app's tight tracking (-0.01/-0.02em).

## 4. The Flow Line — proprietary illustration system

The signature brand element: **one continuous hand-drawn line** — a single unbroken bone-white stroke that travels through doodles of the app's parts (draws a note corner → flows into a canvas arrow → loops into a checkbox → streams into a node cluster). It never lifts off the page. It is the wordless argument for "one app, one flow."

Inspired by Anthropic's hand-drawn animated line art, but ours is defined by continuity/flow, not botany.

**Family:**
1. **The Current** — hero mark on the home page: the line draws itself across the viewport (~2s stroke-draw on load), connecting note → canvas → task → Brain.
2. **Spot marks** — small single-stroke doodles per context: cursor squiggle, checkbox, paper plane (connectors), two overlapping cursors (future team workspaces), wandering line (404). Draw-on ~800ms when they enter the viewport.
3. **NOT the Brain.** The Brain is never illustrated — it is always shown as the real product UI (see §6 and 11-ai-brain-page.md).

**Rules:**
- Single stroke weight (~2px), deliberately imperfect/wobbly — hand-drawn, not geometric
- Bone-white at ~90% opacity on dark
- **At most one orange filled shape per illustration** (the Claude-flower trick)
- Animation: stroke draw-on and a barely-there idle sway ONLY. Never bounce, spin, or loop visibly.
- Delivered as inline SVGs (stroke-dashoffset animation)

## 5. Motion system

Principles: **few, precise, once.** Entrance animations play a single time. Everything under ~600ms except the two signature draws. Full `prefers-reduced-motion` support (static final states).

**The four signature moves — and only these:**
1. **Stroke-draw** — Flow Line marks draw themselves (hero ~2s, spot marks ~800ms)
2. **Brain growth** — nodes fade/scale in one by one, connection lines draw between them (`/ai` hero; see 11)
3. **Glass rise** — screenshots/panels enter with a small rise + fade on first scroll-in (~350ms)
4. **App-native hover** — buttons and cards use the app's own hover language: small transitions (~150–200ms eases), brief scale on some buttons. The site inherits the app's interaction feel exactly — do not invent a new one. When in doubt, open the app component and copy its transition values.

**Interactive inventory (complete list — nothing else is interactive):**
- Mini canvas playground (home §4)
- Simulated AI chat, auto-playing, persona tabs (home §5, /ai §3)
- Live draggable Brain graph (/ai hero)
- Roadmap upvotes + proposal form (/updates)

## 6. Imagery rules

- **Real app screenshots only** — dark theme, framed as floating glass panels with the app's radius scale (24px outer). No browser chrome, no fake data that looks lorem-ipsum. Screenshot content must look like a real person's workspace (believable notes, real-looking tasks).
- **Short silent videos (5–10s)** for workflows that don't read in a still: dragging a canvas arrow, slash-menu insert, task drag between columns. Auto-play on in-view, pause off-view, no controls, loop seamlessly.
- **The Brain is always the real thing:** any Brain visual is rendered with the actual app's node-card + connection-line styling, pixel-identical. Never a stylized abstraction.
- No stock photos. No 3D blobs. No emoji as icons — mono line icons matching the app's icon set.

## 7. Layout geometry

- 4px base grid; section gaps 96–160px on desktop (editorial breathing room, more generous than the app)
- Content max-width ~1200px; editorial text passages narrower (~720px)
- Radius scale from the app: 24px big cards, 15–16px panels, 12px images, 8px small elements
- Dark-first. A light mode is nice-to-have, not v1-required — the app screenshots are dark, so dark pages frame them best.
