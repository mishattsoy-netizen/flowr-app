# History Report

User request: "but it should have same hover effect when row not selected as plus and option"

## 0. Date and Time
2026-05-26 at 13:31

## 1. User Request
User request: "but it should have same hover effect when row not selected as plus and option"

## 2. Objective Reconstruction
The chevron overlay was a `div` element, while Plus and Options are `button` elements with `btn-sidebar-utility`. Even though the CSS values were identical, a `div` vs `button` can behave differently for hover states in browsers.

## 3. Strategic Reasoning
Changed the chevron from `div` to `button` with `btn-sidebar-utility` directly applied plus absolute positioning. This makes the hover state identical to Plus/Options — same element type, same class, same computed styles.

## 4. Operational Trace
- Changed `<div onClick...>` to `<button onClick...>` for the chevron overlay
- Applied `btn-sidebar-utility` directly (22×22, rounded-tiny, hover:text-bone-100, hover:bg-app-dark, transition-none)
- Kept `absolute -top-[4px] -left-[4px]` to center the 22×22 button over the 14×14 icon
- Kept `opacity-0 group-hover:opacity-100` for show-on-row-hover behavior

## 6. Status Assessment
- ✅ Chevron is now a proper button with btn-sidebar-utility — identical hover effect to Plus/Options
- ✅ Still replaces icon on hover (overlay approach preserved)
