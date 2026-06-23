User request: "these didnt change"

## 0. Date and time of the request
21.05 16:45

## 1. User request
User request: "these didnt change" (font weights still not visibly different in light mode)

## 2. Objective Reconstruction
Font weight changes still not being applied. The attempt to override them in `@layer base` failed because Tailwind places its utility classes in `@layer utilities`, which always takes precedence over `@layer base` in the CSS cascade - regardless of selector specificity.

## 3. Strategic Reasoning
In CSS Cascade Layers, the layer order determines priority. `@layer utilities` (Tailwind's layer) always wins over `@layer base`, no matter how specific the selectors inside `@layer base` are. Even `!important` inside a lower-priority layer still loses to a normal declaration in a higher-priority layer.

The fix: Move the font-weight overrides completely OUTSIDE any `@layer` block. In CSS, unlayered styles always beat layered styles. So plain CSS rules (not inside any `@layer`) will override anything Tailwind generates in `@layer utilities`.

## 4. Detailed Blueprint
- `src/app/globals.css`: Removed font-weight rules from inside `@layer base`. Added them as plain, unlayered CSS rules directly after the closing `}` of `@layer base`.

## 5. Operational Trace
- Replaced the in-layer font-weight selectors with unlayered equivalents.

## 6. Status Assessment
These plain CSS rules now sit outside all layer blocks and will definitively override any Tailwind-generated utility class font-weight, regardless of layer priority.
