# Design Handoff — Brief for Claude Design

You are designing the marketing website for **Flowr**. Read `00-overview.md` and `01-brand-vibe-style.md` fully before anything else — they define positioning, color roles, typography, and the illustration system. Then design pages in numbered order (10 → 17), most complex first.

---

## Non-negotiables

1. **Design system = the app's.** Dark-first warm charcoal `#1b1b1a`, bone text `#eeeee8`, glass panels, 24px outer radii. Typography: **Libertinus Serif** display / DM Sans UI / DM Mono data. Not Crimson Pro.
2. **Color discipline:** regular buttons monochrome. Brand blue `#2A78D6` ONLY for primary CTAs and key highlights (one blue element per viewport). Orange `#e48921` ONLY inside illustrations as a single filled shape — never on UI.
3. **No hype aesthetics:** no purple gradients, no glow trails, no 3D blobs, no stock photos, no emoji icons. The vibe is editorial product magazine (references: Notion, Claude/Anthropic, Revolut's restraint).
4. **The Brain is always real product UI** — node cards + connection lines exactly as the app renders them. Never a stylized brain illustration.
5. **Screenshots are real app captures** in floating glass frames, dark theme, with believable human content (a real-looking workspace, not lorem ipsum).

## The Flow Line illustration system (to be drawn)

Hand-drawn, single-stroke, bone-white line art — one continuous unbroken line per illustration, deliberately imperfect (~2px stroke), at most one orange filled shape each. Animated by stroke draw-on. Deliver as SVG.

**Needed pieces:**
| Mark | Where | Content |
|---|---|---|
| The Current | Home hero | One line flowing through: note corner → canvas arrow → checkbox → node cluster |
| Resting Current | Home final CTA | The same line settling into a calm resting shape |
| Cursor squiggle | Feature blocks | Playful cursor gesture |
| Checkbox doodle | Tasks contexts | Loose checkbox with a stroke check |
| Paper plane | Connectors row | Single-stroke plane |
| Two cursors | Roadmap "Someday" (teams) | Overlapping cursor outlines |
| Wandering line | 404 | A line that drifts off the page edge |
| Sprout/spark | /start, changelog | Small "new" mark |

## Screenshot & video shot-list (real captures, dark theme)

| Asset | Content | Used on |
|---|---|---|
| S1 | Note editor with slash-menu open, believable note | Home §3, /start |
| S2 | Canvas: moodboard/diagram mid-gesture, arrow being dragged | Home §3 |
| S3 | Tracker board with realistic tasks across columns | Home §3 |
| S4 | Bento dashboard, curated widgets | Home §3 or /ai capabilities |
| S5 | Brain canvas: nodes + connections (real UI) | /ai hero reference |
| S6 | AI chat: assistant answering with workspace context | /ai |
| S7 | Split view: note + canvas side by side | Home §2 turn or /download |
| V1 (video 5–10s) | Dragging canvas arrow, it sticks to a shape | Home §3 |
| V2 | Slash-menu → insert table → type | Home §3 |
| V3 | Task dragged between columns | Home §3 |

## Interactive moments to design states for

1. **Mini canvas playground** (home): bounded strip; 2–3 draggable shapes, an arrow that sticks, freehand scribble. Design: empty state + "Go on, drag something." caption.
2. **Simulated AI chat** (home + /ai): auto-playing typed exchange, ~3 turns; /ai version has persona tabs (Freelancer / Founder / Student) and shows the AI performing an action (creating a note, updating tasks) inline.
3. **Live Brain graph** (/ai hero): real app node/connection styling; growth animation (nodes appear one by one, lines draw); draggable nodes with lines following.
4. **Roadmap voting** (/updates): upvote control (mono idle → blue voted), vote count in DM Mono, proposal form.

## Motion notes for mockups

Indicate animation intent in mockups (annotations fine): stroke-draw for illustrations, brain growth, glass rise on scroll-in (~350ms), hover states matching the app (~150–200ms transitions, brief scale on some buttons). Nothing loops visibly. Entrances play once.

## Deliverables checklist

- [ ] Desktop + mobile mockups per page (10–17), 404 included
- [ ] Nav (idle + scrolled/glassy) and footer
- [ ] Flow Line SVG set (table above)
- [ ] Interactive-moment states (idle/active/voted/etc.)
- [ ] OG card template (serif statement on charcoal)
- [ ] Empty/success states for email capture + proposal form
