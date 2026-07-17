# Settings Phase 1: Structure + UI Polish

**Date:** 2026-07-17  
**Status:** Approved for planning  
**Scope:** Structure cleanup + visual polish of Settings modal/page. No new product features.

---

## 1. Goals

1. Remove the **Capabilities** tab (bot memories live on the dedicated Brain page).
2. Polish remaining settings tabs for hierarchy, attention grammar, and visual consistency with the polished Usage tab.
3. Use **cards as accents only** (max one dark featured block per tab).
4. Preserve existing **segmented sliders** and **toggle switches** exactly (style and behavior).
5. Use **brand blue sparingly** as a true accent (progress, primary actions, focus, sparse status) — never as bulk decoration.

## 2. Non-goals (later phases)

- Privacy / Notifications tabs or shells  
- Apple / GitHub OAuth `linkIdentity` / `unlinkIdentity`  
- New Flowr AI prefs (default mode, response style, language, etc.)  
- New connectors beyond restyling Telegram  
- Billing tab  
- Restyling slider track/pill or toggle-switch components  
- Implementing settings search filtering  

## 3. Final tab list (Phase 1)

| Order | Tab | Purpose |
|-------|-----|---------|
| 1 | General | App chrome & UX preferences |
| 2 | Account | Identity, linked accounts (display), data actions |
| 3 | Usage | Plan & spend (already polished — leave as-is) |
| 4 | Flowr AI | AI-related settings (timezone today) |
| 5 | Connectors | External app connections |
| 6 | What’s New | Changelog / desktop update check |

**Removed:** Capabilities.

---

## 4. Design system

### 4.1 Controls (locked)

- **Segmented sliders** (Appearance, Interface Scaling): keep `slider-track` / `slider-pill`, radii (`p-[2px]`, pill `rounded-[6px]`), sizing, and motion. Do not recolor the pill with brand blue.
- **Toggles**: keep existing `Toggle` / `.toggle-switch` styles. Layout may reposition them; chrome does not change.

### 4.2 Brand blue accent grammar

Blue means **active / primary / progress**, not decoration.

| Use brand blue | Do not use brand blue |
|----------------|------------------------|
| Progress fills (Usage bars) | Section titles, body copy, default icons |
| True primary CTAs when one exists (e.g. Apply promo) | Every button, nav items, row backgrounds |
| Input focus ring (existing pattern) | Inactive nav, hero card fills |
| Sparse status when useful (e.g. Verified / Connected chip) | Decorative underlines, multi-blue chrome |

**Rule of thumb:** ≤1–2 blue moments visible at a glance in a tab’s content area (excluding Usage bars which are intentionally progress).

### 4.3 Hierarchy & attention grammar

1. **Sidebar nav** — quiet list; active state = subtle surface fill (e.g. `#2b2a29` / bone surface), **not** a blue bar. Scan by label.
2. **Section title** — ~15px semibold `bone-100`; optional one-line description `bone-60` / 13px.
3. **Hero block (≤1 per tab)** — `rounded-2xl bg-[var(--app-dark)]`, **borderless**, padding ~`p-4`. Highest-value controls for that tab. No blue wash on the card.
4. **Supporting rows** — open list: label + helper left, control right. Soft separators or spacing; avoid harsh stacked `#2e2e2e` borders where they feel heavy.
5. **Danger zone** — isolated at bottom; red-soft actions; never inside the hero card; never blue.
6. **Spacing** — tighter inside a group/card; more air between sections so the eye steps: *title → hero → secondary → danger*.

### 4.4 Typography tokens (content area)

| Role | Treatment |
|------|-----------|
| Section title | ~15px, semibold, `bone-100` |
| Section blurb | 13px, `bone-60` |
| Row title | 14px, medium or semibold |
| Helper / meta / reset timers | 12–13px, `bone-60` |
| Primary body labels | `bone-100` |

### 4.5 Card rule

- Default layout = **list rows**, not cards.  
- **At most one** `app-dark` accent card per tab for the most important block.  
- Future tabs (e.g. Billing) should follow the same rule.

---

## 5. Per-tab layout

### General

- **Hero:** Appearance + Interface Scaling (existing sliders, unchanged control chrome).  
- **List below:** Tabs Navigation, Chat “New Note” Button — existing toggles; add/keep short helpers where helpful.

### Account

- **Hero:** Profile identity (avatar, display name, email).  
- **List:** Connected account chips (**display-only** this phase — no new link/unlink wiring), Local Cache, Delete All Data (danger, outside hero).  
- Sign-out remains with profile actions if already present.

### Usage

- **No structural change.** Already matches the system (bars in one dark container, thicker tracks, typography tweaks already applied).

### Flowr AI

- **Hero:** Timezone control (only real AI setting today).  
- Optional short note that memory / deeper AI knowledge is managed in **Brain** (copy only).

### Connectors

- **Hero:** Telegram connector restyled to borderless `app-dark` card; keep connect/disconnect behavior.  
- Space below for future connectors (no empty shells required).

### What’s New

- **Hero (desktop only):** “Check for updates” strip → borderless `app-dark` card.  
- Patch notes: keep existing release cards (changelog pattern, not settings rows).

---

## 6. Capabilities removal

### UI

- Remove Capabilities from nav + content in:
  - `src/components/modals/SettingsModal.tsx`
  - `src/components/settings/SettingsPage.tsx` (if still used)

### Types / routing

- Remove `capabilities` from active `SettingsTab` unions used by the modal (e.g. `SettingsModal` export and `src/data/store.types.ts` if still listing it as a real tab).
- Any `openModal({ kind: 'settings', tab: 'capabilities' })` callers: remove or retarget (prefer no deep-link, or open `general`).

### Code retention

- Keep `CapabilitiesPanel.tsx` in the repo for now (Brain may still reuse patterns/actions). Do not wire it in Settings. Optional later cleanup of dead imports only.

---

## 7. Implementation touchpoints

| Area | Files (expected) |
|------|------------------|
| Modal shell + General / Account chrome | `SettingsModal.tsx` |
| Full-page settings (if used) | `SettingsPage.tsx` |
| Profile block | `ProfileSection.tsx` |
| Flowr AI | `AISettingsSection.tsx` |
| Telegram | `TelegramConnector.tsx` |
| What’s New | `UpdatesSection.tsx` (light) |
| Types / deep-links | `store.types.ts`, grep for `capabilities` settings tab |
| Usage | No required changes |

Shared markup patterns may be small local helpers or repeated class strings; **no new design-system package** required for Phase 1.

---

## 8. Product context (out of scope, recorded for later)

Recommended future phases (not implemented here):

| Phase | Scope |
|-------|--------|
| 2 | Flowr AI prefs: default mode, response style, language; persist in `user_settings` |
| 3 | Account: real Google/Apple/GitHub link & unlink via Supabase |
| 4 | Privacy + Notifications tabs with only toggles the backend can honor |
| 5 | New connectors (e.g. Google Calendar first) |

Account logins vs app connectors stay separate:

- **Account** = Google / Apple / GitHub identities  
- **Connectors** = Telegram, calendar, Slack, etc.

---

## 9. Success criteria

- [ ] Capabilities tab gone from Settings nav and content; no broken deep-links  
- [ ] Each remaining tab (except Usage, already done) follows: title → ≤1 dark hero → list → danger if any  
- [ ] Segmented sliders and toggles look and behave as before  
- [ ] Brand blue only used per accent grammar (no blue-washed cards or nav)  
- [ ] Typography/secondary text use `bone-60` consistently for helpers  
- [ ] Telegram, timezone, profile save/sign-out, cache/delete still work  
- [ ] No new empty Privacy/Notifications/Billing tabs  

## 10. Verification

1. Open Settings modal; confirm tab list and order.  
2. Walk each tab: hierarchy, one hero max, controls intact.  
3. Toggle theme/scale/tabs/chat button; save profile; timezone; Telegram status.  
4. Confirm no route/UI still opens Capabilities.  
5. Spot-check light + dark if both themes are supported for settings chrome.
