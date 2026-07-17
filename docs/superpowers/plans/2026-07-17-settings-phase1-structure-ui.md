# Settings Phase 1: Structure + UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Capabilities settings tab and polish remaining Settings tabs with list + max-one `app-dark` hero card hierarchy, while preserving slider/toggle chrome and sparse brand-blue accents.

**Architecture:** Pure UI structure work across the Settings modal, Settings page (if mirrored), and a few panel components. No API changes. Capabilities deep-links retarget to Brain. Usage tab left as-is.

**Tech Stack:** React, Tailwind CSS v4 utility classes, existing bone tokens (`--app-dark`, `--bone-*`, `--brand-blue`), existing `Toggle` and slider-track/pill components.

**Spec:** `docs/superpowers/specs/2026-07-17-settings-phase1-structure-ui-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `src/components/modals/SettingsModal.tsx` | Modal tabs, General/Account shell, remove Capabilities |
| `src/components/settings/SettingsPage.tsx` | Full-page settings mirror of modal (keep in sync) |
| `src/data/store.types.ts` | `SettingsTab` union cleanup |
| `src/components/assistant/components/ChatMessage.tsx` | Retarget `tab: 'capabilities'` → Brain |
| `src/components/profile/ProfileSection.tsx` | Account hero + list structure |
| `src/components/settings/AISettingsSection.tsx` | Flowr AI hero (timezone) |
| `src/components/settings/TelegramConnector.tsx` | Connectors hero card |
| `src/components/settings/UpdatesSection.tsx` | Desktop update check as hero |
| `src/components/settings/UsagePanel.tsx` | No required changes |
| `src/components/settings/CapabilitiesPanel.tsx` | Keep file; unwired from Settings |

**Shared hero class string (use consistently):**

```tsx
"rounded-2xl bg-[var(--app-dark)] p-4"
```

**Shared list row pattern:**

```tsx
<div className="flex items-center justify-between py-4 border-b border-[var(--bone-6)] last:border-b-0">
  <div className="min-w-0 pr-4">
    <h4 className="text-[14px] font-medium text-[var(--bone-100)]">Label</h4>
    <p className="text-[13px] text-[var(--bone-60)] mt-0.5">Helper</p>
  </div>
  {/* control */}
</div>
```

Do **not** change `Toggle` component or slider `p-[2px]` / `rounded-[8px]` / `slider-pill` markup.

---

### Task 1: Remove Capabilities tab + fix deep-links

**Files:**
- Modify: `src/components/modals/SettingsModal.tsx`
- Modify: `src/components/settings/SettingsPage.tsx`
- Modify: `src/data/store.types.ts`
- Modify: `src/components/assistant/components/ChatMessage.tsx`

- [ ] **Step 1: Update SettingsModal tab type and nav**

In `SettingsModal.tsx`:

1. Change export type to:

```ts
export type SettingsTab = 'general' | 'account' | 'usage' | 'ai' | 'connectors' | 'updates';
```

2. Remove `Brain` from lucide imports if unused.
3. Remove Capabilities entry from `tabs` array.
4. Remove `activeTab === 'capabilities'` content block and `CapabilitiesPanel` import.
5. Guard tab restore: if `modal.tab === 'capabilities'`, set `activeTab` to `'general'` (or ignore).

```ts
useEffect(() => {
  if (modal?.kind === 'settings') {
    const tab = modal.tab as SettingsTab | 'capabilities' | undefined;
    if (tab && tab !== 'capabilities' && ['general','account','usage','ai','connectors','updates'].includes(tab)) {
      setActiveTab(tab as SettingsTab);
    }
    setIsVisible(true);
  } else {
    setIsVisible(false);
  }
}, [modal?.kind, modal?.kind === 'settings' ? modal.tab : undefined]);
```

(Simpler acceptable approach: if tab is capabilities, `setActiveTab('general')`.)

- [ ] **Step 2: Mirror removal on SettingsPage**

In `SettingsPage.tsx`:
- Remove Capabilities from `tabs` array
- Remove capabilities content block + `CapabilitiesPanel` import
- Remove unused `Brain` import

- [ ] **Step 3: Clean store.types SettingsTab**

In `src/data/store.types.ts`, remove `'capabilities'` from the `SettingsTab` union. Leave other legacy tab ids if still present elsewhere (do not expand scope cleaning every historical alias unless TypeScript forces it).

- [ ] **Step 4: Retarget ChatMessage manage_brain click**

In `ChatMessage.tsx` (~1912), replace opening settings capabilities with opening Brain:

```ts
if (actionName === 'manage_brain') {
  useStore.getState().setActiveEntityId('brain');
  return;
}
```

Confirm `setActiveEntityId` exists on the store (it is used elsewhere for `'brain'`). If the chat UI should also close settings, no-op if settings was not open.

- [ ] **Step 5: Grep for leftover settings capabilities references**

Run:

```powershell
rg "tab:\s*['\"]capabilities['\"]|SettingsTab.*capabilities|'capabilities'" src --glob "*.{ts,tsx}"
```

Expected: no remaining Settings deep-links to capabilities (CapabilitiesPanel/actions paths OK).

- [ ] **Step 6: Commit**

```powershell
git add src/components/modals/SettingsModal.tsx src/components/settings/SettingsPage.tsx src/data/store.types.ts src/components/assistant/components/ChatMessage.tsx
git commit -m "feat(settings): remove Capabilities tab and retarget Brain deep-link"
```

---

### Task 2: Polish General tab (hero + list)

**Files:**
- Modify: `src/components/modals/SettingsModal.tsx` (general section)
- Modify: `src/components/settings/SettingsPage.tsx` (mirror if structure duplicated)

- [ ] **Step 1: Restructure General in SettingsModal**

Replace the general tab content with:

1. Section title **Preferences** (15px semibold) + optional blurb in `bone-60`.
2. **Hero card** wrapping only Appearance + Interface Scaling rows (sliders **unchanged**).
3. **List** outside card for Tabs Navigation + Chat New Note (toggles **unchanged**).
4. Soft borders `border-[var(--bone-6)]` inside groups; more space between hero and list (`mt-6` or `space-y-8`).
5. Helper text for Chat New Note stays; use `text-[var(--bone-60)]`.
6. Prefer `text-[var(--bone-100)]` over bare `text-bone-100` only if mixed inconsistently — match surrounding file style.

Example structure:

```tsx
{activeTab === 'general' && (
  <div className="space-y-8">
    <section>
      <h3 className="text-[15px] font-semibold text-[var(--bone-100)]">Preferences</h3>
      <p className="text-[13px] text-[var(--bone-60)] mt-1">
        Appearance and interface controls for this device.
      </p>

      <div className="mt-5 rounded-2xl bg-[var(--app-dark)] p-4 space-y-0">
        {/* Appearance row — keep existing slider markup */}
        {/* Interface Scaling row — keep existing slider markup */}
      </div>

      <div className="mt-6">
        {/* Tabs Navigation row + Toggle */}
        {/* Chat New Note row + Toggle */}
      </div>
    </section>
  </div>
)}
```

Inside the hero, rows can use `py-3` and a light divider `border-b border-[var(--bone-6)]` between the two slider rows (last without border).

- [ ] **Step 2: Mirror on SettingsPage if it has its own General markup**

Apply the same structure so full-page settings does not diverge.

- [ ] **Step 3: Visual check checklist (manual)**

- [ ] Sliders still animate and select theme/size
- [ ] Toggles still flip
- [ ] One dark card only; no brand-blue on card or slider pill
- [ ] Secondary text is bone-60

- [ ] **Step 4: Commit**

```powershell
git add src/components/modals/SettingsModal.tsx src/components/settings/SettingsPage.tsx
git commit -m "style(settings): polish General tab with hero card layout"
```

---

### Task 3: Polish Account tab + ProfileSection

**Files:**
- Modify: `src/components/modals/SettingsModal.tsx` (account shell)
- Modify: `src/components/settings/SettingsPage.tsx` (mirror)
- Modify: `src/components/profile/ProfileSection.tsx`

- [ ] **Step 1: ProfileSection signed-in layout**

Restructure signed-in profile:

1. Wrap **Avatar + Full name + Email** in a single `rounded-2xl bg-[var(--app-dark)] p-4` hero.
2. Connected Accounts as a list section **outside** the hero (chips stay display-only; connected chip may keep existing brand-blue sparse accent).
3. Save / Sign Out row below connected accounts (Save may stay neutral gray; optional: Save uses brand-blue **only if** you want one primary CTA — prefer **neutral** Save to avoid extra blue; keep Apply promo as the usage primary blue example).
4. Do not put danger actions inside ProfileSection.

Verified chip: keep sparse blue or subtle accent; one blue chip is OK.

- [ ] **Step 2: Account shell in SettingsModal**

```tsx
{activeTab === 'account' && (
  <div className="space-y-8">
    <section>
      <h3 className="text-[15px] font-semibold text-[var(--bone-100)]">Profile</h3>
      <p className="text-[13px] text-[var(--bone-60)] mt-1">Your identity on Flowr.</p>
      <div className="mt-5">
        <ProfileSection />
      </div>
    </section>

    <section>
      <h3 className="text-[15px] font-semibold text-[var(--bone-100)]">Data</h3>
      <p className="text-[13px] text-[var(--bone-60)] mt-1">Local cache and irreversible workspace actions.</p>
      <div className="mt-4">
        {/* Local Cache row */}
        {/* Delete All Data danger row — outside any app-dark hero */}
      </div>
    </section>
  </div>
)}
```

Remove the old nested “Profile” heading if ProfileSection/section title double up — either section title in shell **or** inside ProfileSection, not both large titles.

- [ ] **Step 3: Mirror SettingsPage Account**

- [ ] **Step 4: Commit**

```powershell
git add src/components/profile/ProfileSection.tsx src/components/modals/SettingsModal.tsx src/components/settings/SettingsPage.tsx
git commit -m "style(settings): polish Account profile hero and data section"
```

---

### Task 4: Polish Flowr AI tab

**Files:**
- Modify: `src/components/settings/AISettingsSection.tsx`
- Modify: `src/components/modals/SettingsModal.tsx` / `SettingsPage.tsx` only if outer headings duplicate

- [ ] **Step 1: Hero-wrap timezone**

```tsx
return (
  <div className="max-w-2xl pb-10">
    <div className="rounded-2xl bg-[var(--app-dark)] p-4 space-y-3">
      <div>
        <h4 className="text-[14px] font-semibold text-[var(--bone-100)]">AI Timezone Context</h4>
        <p className="text-[13px] text-[var(--bone-60)] mt-1">
          By default, the AI infers your timezone from your device. Lock it if you travel or use a VPN.
        </p>
      </div>
      <TimezoneSelect value={manualTimezone} onChange={handleTimezoneChange} timezones={timezones} />
    </div>
    <p className="text-[13px] text-[var(--bone-60)] mt-6">
      Memory and personal facts are managed in Brain, not here.
    </p>
  </div>
);
```

Keep `TimezoneSelect` control styling (focus may use brand-blue — allowed).

- [ ] **Step 2: Avoid double section titles**

If modal wraps with “Flowr AI” `h3`, keep one page title in the modal and drop redundant outer spacing from `space-y-12` if empty.

- [ ] **Step 3: Commit**

```powershell
git add src/components/settings/AISettingsSection.tsx src/components/modals/SettingsModal.tsx src/components/settings/SettingsPage.tsx
git commit -m "style(settings): polish Flowr AI timezone hero card"
```

---

### Task 5: Polish Connectors (Telegram) + What’s New update strip

**Files:**
- Modify: `src/components/settings/TelegramConnector.tsx`
- Modify: `src/components/settings/UpdatesSection.tsx`
- Modify: modal/page connectors shell headings if needed

- [ ] **Step 1: TelegramConnector hero**

Replace bordered `bone-3` card with:

```tsx
<div className="p-4 rounded-2xl bg-[var(--app-dark)] flex items-center justify-between gap-4">
  {/* existing icon + title + status + disconnect */}
</div>
```

- Connected badge: keep green (status color, not brand-blue overload) OR leave as-is.
- Loading skeleton: match `app-dark` rounded-2xl.
- No border on hero.

- [ ] **Step 2: UpdatesSection desktop check strip**

Change the “App Updates” container from bordered panel to:

```tsx
<div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--app-dark)] mb-2">
```

Keep patch note cards as they are (changelog cards are not “settings heroes”; featured patch blue is existing product treatment — do not expand blue usage further).

- [ ] **Step 3: Connectors shell**

Ensure modal connectors section has title + short blurb, then `<TelegramConnector />` only (one hero).

- [ ] **Step 4: Commit**

```powershell
git add src/components/settings/TelegramConnector.tsx src/components/settings/UpdatesSection.tsx src/components/modals/SettingsModal.tsx src/components/settings/SettingsPage.tsx
git commit -m "style(settings): polish Connectors and What's New heroes"
```

---

### Task 6: Final consistency pass + verify

**Files:**
- Touch any of the above if greps show inconsistency
- Do **not** change `UsagePanel.tsx` unless a bug was introduced earlier

- [ ] **Step 1: Consistency grep**

```powershell
rg "capabilities" src/components/modals/SettingsModal.tsx src/components/settings/SettingsPage.tsx
rg "border-2 border-\[var\(--bone-6\)\]|border border-\[#2e2e2e\]" src/components/settings src/components/profile/ProfileSection.tsx src/components/modals/SettingsModal.tsx
```

Heroes should not use heavy borders. List rows may use `border-[var(--bone-6)]`.

- [ ] **Step 2: Manual QA checklist**

Open Settings modal and verify:

| Tab | Check |
|-----|--------|
| Nav | No Capabilities; order General → Account → Usage → Flowr AI → Connectors → What’s New |
| General | One dark hero (sliders); toggles outside; sliders/toggles work |
| Account | Profile hero; data + danger outside; save/sign-out work |
| Usage | Unchanged bars container |
| Flowr AI | Timezone in hero; Brain note |
| Connectors | Telegram in dark card |
| What’s New | Update check dark card (desktop); patches scroll |
| Blue | No blue-washed cards; focus rings OK; Usage fills OK |
| Brain deep-link | manage_brain result opens Brain, not Settings |

- [ ] **Step 3: Commit any final polish fixes**

```powershell
git add -A src/components/modals/SettingsModal.tsx src/components/settings src/components/profile/ProfileSection.tsx
git commit -m "style(settings): final Phase 1 consistency pass"
```

(Only if there are changes.)

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| Remove Capabilities | Task 1 |
| Retarget deep-links | Task 1 |
| General hero + list | Task 2 |
| Account hero + data/danger | Task 3 |
| Flowr AI hero + Brain note | Task 4 |
| Connectors Telegram hero | Task 5 |
| What’s New update hero | Task 5 |
| Usage unchanged | Tasks note + Task 6 |
| Keep sliders/toggles | Tasks 2 (explicit) |
| Brand blue sparse | All polish tasks |
| Max 1 app-dark card / tab | Tasks 2–5 |
| No Privacy/Notifications shells | Out of plan |

## Out of plan

Phase 2+ from spec (AI prefs, OAuth link/unlink, Privacy/Notifications, new connectors).
