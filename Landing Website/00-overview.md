# Flowr Website — Overview

The single source of truth for the Flowr marketing website. Read this first; every other file in this folder details one page or system.

---

## What Flowr is (positioning)

> **Flowr is a calm, beautiful workspace for everything you know — notes, canvas, and tasks — with a personal AI whose Brain you train to work the way you do.**

**The name means flow** — flow-state, seamless workflow. Not "flower." The brand story: everything you work with is one continuous current instead of five apps you alt-tab between. The enemy is fragmentation: Obsidian/Notion for notes + Figma/Excalidraw for whiteboards + a separate AI + a separate task app, none of which share a memory.

**The keyword is flowstate:** everything I need in one app.

## Audience

- **Primary (broad):** anyone managing knowledge — notes, moodboards/diagrams/graphs on canvas, tasks per workspace. Universal, not just PKM nerds.
- **Secondary but the reason the app exists:** people who want a fully integrated personal AI agent with a customizable Brain. This is what Pro sells.

Persona vignettes used across the site: **The Freelancer**, **The Founder**, **The Student** (see 10-home-page.md §6).

## Business model shown on the site

| Tier | Price | What it is |
|---|---|---|
| **Free** | $0 forever | Local-first desktop app (Mac + Windows). Notes, canvas, tasks, dashboard — unlimited. Data in a local database on-device; Markdown export. No account required. Like Obsidian's posture. |
| **Pro** | ~$20/mo · coming soon | Flowr AI + customizable Brain, web app access, cloud sync with generous storage, connectors (Telegram bot; more later). |
| **Max** | ~$50/mo · coming soon | Everything in Pro + much higher AI limits + bigger cloud storage. |

**Launch state:** open beta. Free download is live and labeled beta honestly. Pro/Max are "coming soon" with email capture. **Beta users get an early-supporter discount when Pro launches** (exact % TBD).

## Sitemap

| Route | Page | Job | Spec file |
|---|---|---|---|
| `/` | Home | The story: one flow instead of five apps → download | 10 |
| `/ai` | Flowr AI & Brain | The soul of the product; live Brain demo | 11 |
| `/pricing` | Pricing | Free vs Pro vs Max; notify-me capture | 12 |
| `/updates` | What's New | Changelog + public roadmap with voting | 13 |
| `/download` | Download | Mac/Windows installers, fastest page on site | 14 |
| `/about` | About | Manifesto; Mikhail; built-in-the-open ethos | 15 |
| `/start` | Getting Started | Slim 5-step guide | 16 |
| `/privacy` `/terms` | Legal | Mandatory before going public | 17 |
| 404 | — | Flow Line wanders off the page | 17 |

**Top nav (persistent, glassy):** `Flowr` wordmark · Flowr AI · Pricing · Updates · About — plus one **Download free** button (brand blue), always visible. The download button is the site's single conversion goal.

## The one-paragraph pitch per page

- **Home** sells the *workspace* first (universal), reveals the *AI + Brain* second (the soul), closes on trust (local-first) and community (built in the open).
- **/ai** answers "what does it mean that the AI has a Brain?" in increasing depth, with the real Brain UI alive on the page.
- **Pricing** flatters the free tier honestly and converts AI interest into a launch mailing list.
- **/updates** turns users into a community: they see momentum (changelog) and steer it (votes + proposals).

## Future roadmap context (appears on site as direction, not promises)

- More third-party connectors for the AI
- Shared workspaces — teams working on the same notes/canvas/tasks in realtime

These live in the roadmap's "Someday" column. Never given dates.

## Quality bar

The explicit goal: the site must feel **high-quality and designed with taste — never like a cheap vibecoded project.** The mechanisms for that, detailed in 01-brand-vibe-style.md:
- Editorial serif design system inherited from the app itself (zero expectation gap between site and product)
- A proprietary illustration system (the Flow Line) instead of stock/emoji/generic 3D blobs
- Real product UI as the demos (the Brain on /ai is the actual app rendering, interactive)
- Restraint: monochrome UI, one blue accent role, rationed orange, few precise animations
- Honest copy: beta honesty, no hype words, signed founder notes
