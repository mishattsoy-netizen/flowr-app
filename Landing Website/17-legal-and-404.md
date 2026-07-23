# Legal Pages & 404 — simplest pages

## `/privacy` and `/terms`

Plain, readable pages in the same design system — matching typography on legal pages is a subtle quality signal. Narrow measure, serif section headings, sans body, DM Mono "last updated" date.

**Privacy policy must cover (accurately — verify each against the actual app):**
- Free app: data stored locally on-device; what (if anything) the free app transmits (updates check, crash reports if any, analytics if any)
- Account data when users sign up (email via Supabase Auth)
- Cloud sync (when enabled): what's stored, where (Supabase), retention, deletion
- Flowr AI: what gets sent to AI model providers when you use it, and that Brain memories are private to the user
- Website itself: analytics choice (privacy-friendly, no cookie banner target), waitlist emails, roadmap votes/proposals
- Contact for data requests; deletion process

**Terms must cover:**
- Beta disclaimer (as-is, may change, back up your data)
- Acceptable use of AI features
- Future paid tiers (billing terms added at Pro launch)
- Ownership: user content belongs to the user

**Process:** draft from the repo's `Legal Compliance Checklist for Platforms (⚖️ Critical).md`, then **human/legal review before real payments launch.** Never let these pages claim anything the app doesn't actually do.

## 404

Ten-minute build, disproportionate charm:
- The **wandering line** Flow Line mark — a single stroke that drifts off the edge of the page
- One serif line: *"This page drifted out of the flow."*
- One mono button: **Back home**

## Footer (site-wide, for reference)

- Columns: Product (AI, Pricing, Download, Updates) · Company (About, Getting Started) · Legal (Privacy, Terms)
- Contact + social links
- Optional one-field email capture: *"Occasional updates, no spam."* (source `footer`)
- Small print: `© 2026 Flowr · Built in the open` + version of latest release linking to changelog
