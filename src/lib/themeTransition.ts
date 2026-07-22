export type AnimationVariant =
  | "circle"
  | "rectangle"
  | "gif"
  | "polygon"
  | "circle-blur";

export type AnimationStart =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center"
  | "top-center"
  | "bottom-center"
  | "bottom-up"
  | "top-down"
  | "left-right"
  | "right-left";

interface Animation {
  name: string;
  css: string;
}

// ── Helper: SVG coords for mask position ──
const getPositionCoords = (position: AnimationStart) => {
  switch (position) {
    case "top-left": return { cx: "0", cy: "0" };
    case "top-right": return { cx: "40", cy: "0" };
    case "bottom-left": return { cx: "0", cy: "40" };
    case "bottom-right": return { cx: "40", cy: "40" };
    case "top-center": return { cx: "20", cy: "0" };
    case "bottom-center": return { cx: "20", cy: "40" };
    default: return { cx: "20", cy: "20" };
  }
};

// ── Helper: CSS position keyword for mask-position / transform-origin ──
const getTransformOrigin = (start: AnimationStart) => {
  switch (start) {
    case "top-left": return "top left";
    case "top-right": return "top right";
    case "bottom-left": return "bottom left";
    case "bottom-right": return "bottom right";
    case "top-center": return "top center";
    case "bottom-center": return "bottom center";
    default: return "center";
  }
};

// ── Helper: CSS mask-position with -5px overscan ──
// Pushing the mask outside the element hides edge interpolation artifacts (the 1px line)
const getMaskPosition = (start: AnimationStart) => {
  switch (start) {
    case "top-left": return "left -5px top -5px";
    case "top-right": return "right -5px top -5px";
    case "bottom-left": return "left -5px bottom -5px";
    case "bottom-right": return "right -5px bottom -5px";
    case "top-center": return "center top -5px";
    case "bottom-center": return "center bottom -5px";
    default: return "center";
  }
};

// ── Helper: clip-path position string ──
const getClipPos = (position: AnimationStart) => {
  switch (position) {
    case "top-left": return "0% 0%";
    case "top-right": return "100% 0%";
    case "bottom-left": return "0% 100%";
    case "bottom-right": return "100% 100%";
    case "top-center": return "50% 0%";
    case "bottom-center": return "50% 100%";
    case "center": return "50% 50%";
    default: return "50% 50%";
  }
};

/**
 * Creates View Transition CSS for theme switching.
 * Uses the EXACT CSS patterns from skiper26.tsx (Skiper UI).
 * The .vt-transitioning class in globals.css handles post-animation flash.
 */
export const createAnimation = (
  variant: AnimationVariant = "circle-blur",
  start: AnimationStart = "bottom-left",
  blur = true,
  url?: string
): Animation => {

  // ── circle-blur: SVG mask with feGaussianBlur (exact skiper26.tsx CSS) ──
  if (variant === "circle-blur") {
    const transformOrigin = getTransformOrigin(start);

    let svg: string;
    if (start === "center") {
      svg = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter></defs><circle cx="20" cy="20" r="18" fill="white" filter="url(%23blur)"/></svg>`;
    } else {
      const { cx, cy } = getPositionCoords(start);
      svg = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter></defs><circle cx="${cx}" cy="${cy}" r="18" fill="white" filter="url(%23blur)"/></svg>`;
    }

    // Exact CSS from skiper26.tsx + mix-blend-mode: normal on OLD only
    // (adding it to NEW breaks the SVG mask; adding it to OLD prevents additive blend flash)
    return {
      name: `circle-blur-${start}`,
      css: `
::view-transition-image-pair(root) {
  isolation: isolate;
}

::view-transition-old(root),
::view-transition-new(root) {
  mix-blend-mode: normal;
}

::view-transition-group(root) {
  animation-timing-function: var(--expo-out);
}

::view-transition-new(root) {
  mask: url('${svg}') ${getMaskPosition(start)} / 0 no-repeat;
  mask-origin: content-box;
  animation: scale 1s forwards;
  transform-origin: ${transformOrigin};
}

::view-transition-old(root),
.dark::view-transition-old(root) {
  animation: scale 1s forwards;
  transform-origin: ${transformOrigin};
  z-index: -1;
}

@keyframes scale {
  to {
    mask-size: 350vmax;
  }
}
      `,
    };
  }

  // ── circle: clip-path reveal ──
  if (variant === "circle") {
    const clipPos = getClipPos(start);
    const id = `circle-${start}`;
    return {
      name: id,
      css: `
::view-transition-group(root) {
  animation-duration: 0.7s;
  animation-timing-function: var(--expo-out);
}

::view-transition-new(root) {
  animation-name: ${id};
}

::view-transition-old(root),
.dark::view-transition-old(root) {
  animation: none;
  z-index: -1;
}

.dark::view-transition-new(root) {
  animation-name: ${id};
}

@keyframes ${id} {
  from { clip-path: circle(0% at ${clipPos}); }
  to   { clip-path: circle(150% at ${clipPos}); }
}
      `,
    };
  }

  // ── rectangle: polygon clip-path wipe ──
  if (variant === "rectangle") {
    const getClipPath = (d: AnimationStart) => {
      switch (d) {
        case "bottom-up": return { from: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)", to: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)" };
        case "top-down": return { from: "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)", to: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)" };
        case "left-right": return { from: "polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)", to: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)" };
        case "right-left": return { from: "polygon(100% 0%, 100% 0%, 100% 100%, 100% 100%)", to: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)" };
        default: return { from: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)", to: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)" };
      }
    };
    const cp = getClipPath(start);
    const id = `rect-${start}`;
    return {
      name: id,
      css: `
::view-transition-group(root) {
  animation-duration: 0.7s;
  animation-timing-function: var(--expo-out);
}

::view-transition-new(root) {
  animation-name: ${id};
}

::view-transition-old(root),
.dark::view-transition-old(root) {
  animation: none;
  z-index: -1;
}

.dark::view-transition-new(root) {
  animation-name: ${id};
}

@keyframes ${id} {
  from { clip-path: ${cp.from}; }
  to   { clip-path: ${cp.to}; }
}
      `,
    };
  }

  // ── gif: mask with gif image ──
  if (variant === "gif") {
    return {
      name: `gif-${start}`,
      css: `
::view-transition-group(root) {
  animation-timing-function: var(--expo-in);
}

::view-transition-new(root) {
  mask: url('${url}') center / 0 no-repeat;
  animation: gif-scale 3s;
}

::view-transition-old(root),
.dark::view-transition-old(root) {
  animation: gif-scale 3s;
}

@keyframes gif-scale {
  0%   { mask-size: 0; }
  10%  { mask-size: 50vmax; }
  90%  { mask-size: 50vmax; }
  100% { mask-size: 2000vmax; }
}
      `,
    };
  }

  // ── polygon: diagonal clip-path ──
  if (variant === "polygon") {
    const clips = start === "top-right"
      ? { dFrom: "polygon(150% -71%, 250% 71%, 250% 71%, 150% -71%)", dTo: "polygon(150% -71%, 250% 71%, 50% 171%, -71% 50%)", lFrom: "polygon(-71% 50%, 50% 171%, 50% 171%, -71% 50%)", lTo: "polygon(-71% 50%, 50% 171%, 250% 71%, 150% -71%)" }
      : { dFrom: "polygon(50% -71%, -50% 71%, -50% 71%, 50% -71%)", dTo: "polygon(50% -71%, -50% 71%, 50% 171%, 171% 50%)", lFrom: "polygon(171% 50%, 50% 171%, 50% 171%, 171% 50%)", lTo: "polygon(171% 50%, 50% 171%, -50% 71%, 50% -71%)" };
    const id = `poly-${start}`;
    return {
      name: id,
      css: `
::view-transition-group(root) {
  animation-duration: 0.7s;
  animation-timing-function: var(--expo-out);
}

::view-transition-new(root) {
  animation-name: ${id}-light;
}

::view-transition-old(root),
.dark::view-transition-old(root) {
  animation: none;
  z-index: -1;
}

.dark::view-transition-new(root) {
  animation-name: ${id}-dark;
}

@keyframes ${id}-dark {
  from { clip-path: ${clips.dFrom}; }
  to   { clip-path: ${clips.dTo}; }
}

@keyframes ${id}-light {
  from { clip-path: ${clips.lFrom}; }
  to   { clip-path: ${clips.lTo}; }
}
      `,
    };
  }

  // Fallback
  return {
    name: "circle-center",
    css: `
::view-transition-group(root) {
  animation-duration: 0.7s;
  animation-timing-function: var(--expo-out);
}

::view-transition-new(root) {
  animation-name: circle-fallback;
}

::view-transition-old(root),
.dark::view-transition-old(root) {
  animation: none;
  z-index: -1;
}

.dark::view-transition-new(root) {
  animation-name: circle-fallback;
}

@keyframes circle-fallback {
  from { clip-path: circle(0% at 50% 50%); }
  to   { clip-path: circle(150% at 50% 50%); }
}
    `,
  };
};

export const updateThemeTransitionStyles = (css: string) => {
  if (typeof window === "undefined") return;
  const styleId = "theme-transition-styles";
  let el = document.getElementById(styleId) as HTMLStyleElement;

  if (!el) {
    el = document.createElement("style");
    el.id = styleId;
    document.head.appendChild(el);
  }

  el.textContent = css;
};
