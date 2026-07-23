# What's New Page (`/updates`) — changelog + roadmap

The community page. Proves momentum (changelog) and shares the wheel (roadmap voting). This page is why users bookmark the site — it makes them feel close to Mikhail as a listening developer, before there's a forum or Discord.

Framing line at top:

> **Flowr is built in the open. What we build next is partly your call.**

Two tabs, one page.

---

## Tab 1 — Changelog

Reverse-chronological releases:
- **Version + date** in DM Mono (`v0.9.4 — July 12, 2026`), anchor-linkable (`/updates#v0-9-4`)
- **Human-written summary** — a few sentences like a note to users, never commit dumps ("Canvas arrows now stick to shapes properly when you move frames…")
- Occasional screenshot/gif for visual features
- Notable releases signed **— Mikhail**
- Grouped tags optional: `editor` `canvas` `ai` `desktop` (mono pills)

Source: one markdown file per release in the site repo (`website/content/changelog/`). Written at release time — this is the heartbeat that proves the project is alive.

## Tab 2 — Roadmap

Three columns:

| **Building now** | **Next up** | **Someday** |
|---|---|---|
| current work | queued next | direction, no dates |
| | | e.g. shared team workspaces (realtime notes/canvas/tasks), more AI connectors, mobile |

Each feature card:
- Title + 1–2 sentence description
- **Upvote control**: mono idle → **brand blue when voted**, count in DM Mono
- Voting is email-only — no account. First vote asks for email inline (one field), stored with consent line: *"We'll email you when this ships. Occasional updates, no spam."*
- One vote per feature per email (enforced by unique constraint)

Below the columns — **Propose a feature**:
- Simple form: title + a few sentences + email
- Response state: *"Got it. Mikhail reads every one."* (and he does — triage weekly at first)
- Proposals reviewed in Supabase dashboard/admin; promising ones appear as roadmap cards with credit optional

## Data (see 03-phases-overview.md for tables/RLS)

- `roadmap_features` — cards, editable from Supabase dashboard (no CMS needed)
- `roadmap_votes` — feature_id + email, unique pair
- `feature_proposals` — title, body, email, status

## Design notes

- The page must read as *alive*: freshest release at top with relative time ("3 days ago" + absolute date)
- If the changelog is young, that's fine — 5 honest entries beat 50 padded ones
- Sprout/spark spot mark for new entries; all marks stay flow-themed per the Flow Line system (01-brand-vibe-style.md §4)
- The app links here from its in-app "What's new"
