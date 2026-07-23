# User Workflow & Conversion Logic

How visitors travel through the site, and what each journey is optimized for.

---

## The single conversion goal

**Free desktop download.** No signup wall, no email gate before download. The free tier IS the funnel — a user with Flowr installed is worth more than an email address.

**Secondary asset:** the Pro/Max launch mailing list (email capture on pricing + /ai + roadmap voting). This is the main pre-revenue asset the site builds.

## Journey 1 — The curious visitor (most traffic)

Lands on `/` from a link. The home page must answer three questions in one scroll:
1. *What is this?* → hero + problem strip (beats 1–2)
2. *Is it for me?* → workspace tour + personas (beats 3–6)
3. *Can I trust it?* → local-first + built-in-open (beats 7–8)

Then: **Download → install → in the app within ~1 minute of site time.**

- Download button is always in the nav and repeated after major story beats
- Time-to-CTA short; nothing blocks the path
- Exit ramp for the skeptical: `/about` (who made this) and `/updates` (is it alive?)

## Journey 2 — The AI-shopper

Comes specifically for "AI workspace / second brain with AI." Path:

`/` hero → clicks "Meet Flowr AI" → `/ai` (reads mechanic, plays with live Brain, reads persona demos) → `/pricing` → two outcomes, both wins:
1. **Downloads free now** ("your workspace will be ready for the Brain when Pro launches")
2. **Leaves email** on Pro "Get notified" (blue button) — with the early-supporter discount as the incentive

Key: this visitor must never feel bait-and-switched. Pro is honestly "coming soon" everywhere; free is honestly great.

## Journey 3 — The returning user

Comes back to `/updates` to see what shipped and steer what's next.

- **Changelog tab:** momentum proof. Human-written, signed releases.
- **Roadmap tab:** votes on features (email-only, no account — one click, blue active state), proposes ideas via a simple form.
- This page is why users bookmark the site. It builds community closeness with Mikhail as a visible, listening developer — before there's a forum or Discord.

Loop mechanics:
- Every changelog entry anchor-linkable → shareable
- Votes/proposals feed the same mailing list (one consent checkbox)
- The app itself links here ("What's new" in-app → /updates)

## Cross-page CTA logic

| Page | Primary CTA | Secondary |
|---|---|---|
| Home | Download free (blue) | Meet Flowr AI (ghost) |
| /ai | Get notified — Pro (blue) | Download free today |
| Pricing | Download (Free card) + Get notified (Pro card, blue) | — |
| /updates | Vote / propose | Download in nav |
| /download | The installers themselves | /start guide |
| /about | — (trust page; nav handles conversion) | — |
| /start | Open the app / Download | — |

Rule: **one blue element per viewport** (the persistent nav Download button doesn't count). If two in-page CTAs are visible, only the primary is blue; the rest are mono.

## Email capture — one system, three doors

Single Supabase table, one field (`email`) + `source` tag:
1. Pro/Max "Get notified" on /pricing and /ai
2. Roadmap voting identity on /updates
3. Optional footer line ("Occasional updates, no spam")

Every door mentions the same promise once: *beta users get an early-supporter discount when Pro launches.*
