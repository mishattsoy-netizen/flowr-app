# FIX: Overlapping / Stacked Stroke on Lucide SVG Icons

## What this means

When you send this file, you want to fix an icon that shows a **doubled / stacked stroke** visual — where the icon looks like it has two outlines on top of each other.

---

## Why it happens

Two common causes:

### Cause 1 — Semi-transparent color on SVG stroke
Using a color like `text-[var(--bone-60)]` (which is rgba / partial alpha) on an SVG icon at high `strokeWidth` causes **alpha compositing artifacts**. Adjacent stroke edges with partial alpha blend over the background and appear as two separate lines.

### Cause 2 — Compound icon with overlapping paths
Icons like `FileText` have **multiple SVG paths** (e.g. page outline + inner text lines). At high stroke weights all paths get thick strokes that visually bleed into each other.

---

## How to fix

### Fix for Cause 1 (alpha color → opacity)
Replace semi-transparent color transition with solid color + opacity:

❌ Wrong:
```tsx
<div className="text-[var(--bone-60)] group-hover/item:text-[var(--bone-100)] transition-colors">
  <Icon strokeWidth={3} className="w-5 h-5" />
</div>
```

✅ Correct:
```tsx
<div className="opacity-40 group-hover/item:opacity-100 transition-opacity text-[var(--bone-100)]">
  <Icon strokeWidth={3} className="w-5 h-5" />
</div>
```

**Why:** SVG composites at full solid color internally → strokes stay crisp single edges. Opacity applied after = no alpha stacking.

---

### Fix for Cause 2 (compound icon → single-path icon)
Swap the multi-path icon for a single-path equivalent:

| Use case | ❌ Avoid | ✅ Use instead |
|---|---|---|
| Note / document | `FileText` | `File` |
| Generic page | `FileText` | `File` |

`File` is a single-path icon (page outline only, no inner text lines) — no paths overlap at any stroke weight.

---

## Rule of thumb

> Always use **solid color + opacity** for dimming SVG icons, never semi-transparent colors.
> Always prefer **single-path icons** when high stroke weight is needed.
