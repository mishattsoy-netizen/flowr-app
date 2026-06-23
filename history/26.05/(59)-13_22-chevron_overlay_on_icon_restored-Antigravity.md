# History Report

User request: "why did you put collapse next to the plus button? it should stay replacing icon on hover"

## 0. Date and Time
2026-05-26 at 13:22

## 1. User Request
User request: "why did you put collapse next to the plus button? it should stay replacing icon on hover"

## 2. Objective Reconstruction
The collapse chevron should be an overlay on the folder icon that appears on hover (replacing the icon), not a separate button in the action strip. The original design intent was correct — icon fades out, chevron appears in its place.

## 3. Strategic Reasoning
Reverted to icon-overlay approach. The chevron div is absolutely positioned over the icon (same 22×22 area as btn-sidebar-utility). On hover: icon fades out, chevron fades in with hover:bg-[var(--app-dark)] — identical visual effect to Plus/Options buttons.

## 4. Operational Trace
- Restored `group-hover:opacity-0 transition-opacity duration-100` on the folder icon wrapper
- Restored the absolutely-positioned chevron overlay div over the icon
- Styled with exact btn-sidebar-utility equivalents: text-[var(--bone-70)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)] rounded-[var(--radius-tiny)]
- Removed the incorrect standalone btn-sidebar-utility button from the action strip

## 6. Status Assessment
- ✅ Chevron replaces icon on hover (overlay approach restored)
- ✅ Hover background matches Plus/Options exactly
- ✅ Chevron removed from action strip
