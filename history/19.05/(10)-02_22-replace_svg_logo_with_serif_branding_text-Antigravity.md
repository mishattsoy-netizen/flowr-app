User request: "repace svg logo to serif our font. Flowr- medium weight, tight tracking. btw no icon log, just text"

## 0. Date and time of the request
Date: 19.05 (May 19, 2026)
Time: 02:22

## 1. User request
"repace svg logo to serif our font. Flowr- medium weight, tight tracking. btw no icon log, just text"

## 2. Objective Reconstruction
Replace the SVG graphical logo inside the sidebar layout with clean, premium branding text matching the application's native design DNA:
1. Render only the brand name "Flowr" as clean text (with no graphical icon log/mark).
2. Apply the custom serif font `'Literata'` (the app's primary serif font token).
3. Style the text with medium weight and tight tracking (`tracking-tight` / `-0.01em` to `-0.02em`).
4. When the sidebar is collapsed, render a single letter "F" styled in the identical serif font.

## 3. Strategic Reasoning
- **Minimalist Aesthetic**: Transitioning from a multi-colored graphical SVG image to pure serif typography creates an extremely sleek, high-fidelity, and sophisticated workspace environment.
- **Visual Harmony**: Leveraging the existing Centralized Literata (`font-serif`) styling class ensures visual coherence with notes page titles and the chat assistant header typography.
- **Responsive Simplicity**: Clean HTML text blocks respond instantaneously to sidebar collapse states, avoiding scaling glitches or blank spaces.

## 4. Detailed Blueprint
- `src/components/layout/Sidebar.tsx`: Replace the standard `img` and SVG components in the sidebar brand title container with customized React `span` elements styled to inherit `font-serif font-medium tracking-tight text-bone-100`.
- Remove the now unused local `LogoSimple` SVG markup helper to keep the layout code clean.

## 5. Operational Trace
- Edited `src/components/layout/Sidebar.tsx` brand heading element to:
  - Render "Flowr" (`font-serif font-medium text-[20px] text-bone-100 tracking-tight leading-none select-none`) when the sidebar is full.
  - Render "F" (`font-serif font-medium text-[19px] text-bone-100 leading-none select-none`) when the sidebar is collapsed.
- Deleted the local SVG representation helper `LogoSimple` on lines 46-50.

## 6. Status Assessment
- **Completed**: The sidebar has been fully upgraded to the new typography-based branding system. The graphic icon was completely removed, replaced by pristine and elegant serif lettering.
- **Recommendation**: Standardize future brand headers to use the centralized `font-serif` token rather than hardcoding custom styles.
