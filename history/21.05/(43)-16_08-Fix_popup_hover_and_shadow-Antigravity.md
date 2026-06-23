User request: "i dont see poup buttons hover. make shadow less visible in ligh mode."

## 0. Date and time of the request
21.05 16:08

## 1. User request
User request: "i dont see poup buttons hover. make shadow less visible in ligh mode."

## 2. Objective Reconstruction
The user reported that the hover state on popup menu buttons is invisible in light mode. Additionally, the drop-shadow behind popups is too intense in light mode. The goal is to make the hover state visually distinct in both modes and reduce the shadow opacity specifically for light mode.

## 3. Strategic Reasoning
The hover state on `.popup-item` was hardcoded to `hover:bg-white/10`. Since the popup's background is white in light mode, adding white over white was completely invisible. Changing it to `hover:bg-[var(--bone-6)]` fixes this, as `bone-6` automatically adapts (6% black in light mode, 6% white in dark mode), giving a subtle highlight in both environments. 

For the shadow, it was hardcoded to `rgba(0, 0, 0, 0.3)`. I introduced a new CSS variable, `--popup-shadow-color`, mapped to `0.1` opacity in light mode (since shadows on white stand out much more harshly) and `0.3` in dark mode.

## 4. Detailed Blueprint
- `src/app/globals.css`: 
  - Added `--popup-shadow-color` to `:root` (with 0.1 opacity).
  - Added `--popup-shadow-color` to `.dark` (with 0.3 opacity).
  - Modified `.popup-glass-big` and `.popup-glass-small` to use `var(--popup-shadow-color)` instead of the hardcoded `rgba(0, 0, 0, 0.3)`.
  - Modified `.popup-item` to use `hover:bg-[var(--bone-6)]` instead of `hover:bg-white/10`.

## 5. Operational Trace
- Replaced the hardcoded white overlay with the adaptive theme variable `bone-6`.
- Refactored the popup glass shadow to use the new CSS variable `--popup-shadow-color`.

## 6. Status Assessment
The popup item hover states are now visible in light mode (subtle grey) and remain functionally identical in dark mode (subtle white). The intense shadow in light mode has been softened to a much cleaner 10% opacity, maintaining the sleek visual aesthetic while fixing the contrast issues.
