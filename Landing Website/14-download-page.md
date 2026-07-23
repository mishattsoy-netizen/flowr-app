# Download Page (`/download`)

The fastest page on the site. One quiet viewport, zero friction: no email gate, no dark patterns, no upsell interruptions.

---

## Layout

> # Two minutes from now, you're in.

Two large platform cards (glass panels, side by side; stacked on mobile):

**macOS**
- Note: Apple silicon / Intel (universal build or two buttons — match actual artifacts)
- `v0.9.4 · 142 MB` in DM Mono — **real numbers, read from the release feed at build time** (never hardcoded, never stale)
- Button: **Download for macOS** (blue on the visitor's detected platform, mono on the other)

**Windows**
- Installer (.exe)
- Same version/size treatment
- Button: **Download for Windows**

Platform detection: the visitor's OS gets the blue button and first position.

## Below the cards

- **Beta note, honest:** *"Flowr is in beta — it's already daily-driver stable, and it updates itself as we ship. Expect an occasional rough edge and a fast fix."*
- **System requirements:** one modest line per platform (macOS version min, Windows 10/11)
- **Next step:** *"First time? The 3-minute tour →"* `/start`
- **Help line:** *"Problems installing? Write me →"* (mailto or contact)
- Small print: link to changelog (`what's in v0.9.4 →`), auto-update mention, `/privacy`

## Notes

- No account creation anywhere in this flow — download → install → open
- macOS signing/notarization + Windows signing status should be verified before launch (unsigned builds throw scary OS warnings that undermine the whole quality story — if unsigned at launch, the page needs honest install instructions)
- Linux: not at launch; if asked, roadmap answer
