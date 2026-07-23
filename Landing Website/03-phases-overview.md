# Phases Overview & Technical Setup

The four phases from plan to public, plus the infrastructure decisions and step-by-step setup guide.

---

## Phase 1 — Vision & planning ✅ (this folder)

Complete plan for positioning, pages, brand system, workflows. Output: these .md files.

## Phase 2 — Design mockups (Claude Design)

Hand this folder (especially `04-design-handoff.md` + the page specs) to Claude Design. Output: UI mockups for every page, desktop + mobile, plus first-pass Flow Line SVG illustrations. Mockups get reviewed by Mikhail, iterated, then exported back for implementation.

## Phase 3 — Implementation (wiring)

Build order inside this phase:
1. **Static skeleton** — all pages, real copy, design tokens imported from the app, responsive, no interactivity
2. **Screenshots & videos** — capture the real shot-list (see 04-design-handoff.md)
3. **The four interactive moments** — mini canvas, simulated chat, live Brain graph, roadmap voting (in that order of increasing backend need)
4. **Supabase glue** — waitlist emails, votes, proposals tables + RLS
5. **Changelog pipeline** — markdown files rendered to /updates; download page reading version/size from the release feed

## Phase 4 — Pre-launch checklist

- [ ] Domain purchased; site on root domain, app on `app.` subdomain
- [ ] OG/social cards per page (serif statement on charcoal — they'll look great in link previews)
- [ ] Favicon + touch icons
- [ ] Privacy-friendly analytics (e.g. Plausible/Umami — no cookie banner needed)
- [ ] Legal pages human-reviewed (see repo's `Legal Compliance Checklist for Platforms`)
- [ ] Lighthouse pass: 95+ performance, images optimized, fonts subset+preloaded
- [ ] Real installers linked, auto-update feed verified, versions display correctly
- [ ] 404 works; all anchor links work; reduced-motion verified
- [ ] Meta titles/descriptions per page; sitemap.xml; robots.txt
- [ ] Announce: beta users emailed, app's in-app "What's new" points at /updates

---

# Technical architecture decisions

## Where the website lives: THIS repo, `website/` subfolder

**Decision: monorepo, separate deployment.** The site is a folder in this repo (e.g. `website/` — its own Next.js app), NOT a separate repo.

Why:
- **Claude access:** working sessions on the site need the app's code right there — to copy hover transition values, reuse the Brain canvas rendering, import design tokens. A separate repo would blind those sessions.
- **Shared tokens:** the site imports the bone palette/typography from the app's `globals.css` conventions so site and app never drift.
- **Independent deploys anyway:** Vercel supports multiple projects from one repo.

## Vercel: one repo → two projects (setup guide)

Current state: the app (with `/app`, `/login`, etc.) deploys as one Vercel project. The web app **stays in this repo and that project, unchanged.**

Adding the website project:
1. Vercel dashboard → **Add New → Project** → import the same GitHub repo again
2. In the new project's settings: **Root Directory = `website`** (Build & Development Settings auto-detect Next.js)
3. Now: pushes touching `website/` deploy the site; the app project can ignore them (Settings → Git → **Ignored Build Step**: `git diff --quiet HEAD^ HEAD -- ':!website'` on the site project and the inverse on the app project — optional optimization, works fine without)
4. Domains (later): `yourdomain.com` + `www` → website project; `app.yourdomain.com` → existing app project. Subdomain split is the norm (notion.com vs app.notion.so) and far simpler than path rewrites.

## Supabase: same project, three new tables

No second Supabase project. Add to the existing one:

| Table | Columns (sketch) | Access |
|---|---|---|
| `waitlist_emails` | id, email (unique), source (pricing-pro / pricing-max / ai-page / roadmap / footer), created_at | anon INSERT only, RLS: no select |
| `roadmap_votes` | id, feature_id, email, created_at, unique(feature_id,email) | anon INSERT; vote counts exposed via a view or edge function |
| `feature_proposals` | id, title, body, email, created_at, status (new/considering/planned/rejected) | anon INSERT only; Mikhail reviews in Supabase dashboard or admin panel |

Roadmap feature cards themselves: start as a simple `roadmap_features` table (title, description, column: now/next/someday, vote_count view) editable from the Supabase dashboard — no CMS needed at this scale.

## Site tech stack

- **Next.js (App Router) + Tailwind v4** — same stack as the app, static-first (SSG) for every page; only the vote/waitlist endpoints are dynamic
- **Fonts:** Libertinus Serif, DM Sans, DM Mono via `next/font` (same config as the app)
- **Changelog:** one markdown file per release in `website/content/changelog/`, rendered at build time. Mikhail writes them like notes.
- **Download links:** read latest version/size from the existing release pipeline (GitHub Releases API or the electron-builder update feed) at build time + ISR revalidation, so the page never shows stale numbers
- **Interactive demos:** adapted read-mostly copies of real app components (Brain canvas rendering, mini canvas) — same visual output, persistence stripped. Living in the same repo makes this a copy-and-trim job, not a rebuild.

## Update cadence after launch

- Changelog entry per release (5–15 min of writing) — this is the heartbeat that proves the project is alive
- Roadmap groomed monthly; proposals triaged weekly at first
- Screenshots refreshed when the app UI meaningfully changes (site must never show a stale-looking app)
