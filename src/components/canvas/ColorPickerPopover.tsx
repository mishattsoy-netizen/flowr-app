"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

import { createPortal } from "react-dom";

interface ColorPickerPopoverProps {
  color: string; // e.g. '#ffffff' or 'transparent' or '#d38f36' or 'default'
  opacity?: number; // 0 to 1
  onChange: (color: string, opacity: number) => void;
  onClose: () => void;
  className?: string;
  style?: React.CSSProperties;
}

// Simple color helper math
function rgbToHsv(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    v: Math.round(v * 100),
  };
}

function hsvToRgb(h: number, s: number, v: number) {
  h = h % 360;
  if (h < 0) h += 360;
  s /= 100;
  v /= 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else if (h >= 300 && h < 360) {
    r = c; g = 0; b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, n)).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function parseColorToHsv(color: string): { h: number; s: number; v: number } {
  let hex = color || "#ffffff";
  if (hex === "transparent") {
    return { h: 0, s: 0, v: 100 };
  }
  if (hex === "default") {
    hex = "#F8F8F6";
  }
  hex = hex.replace("#", "");
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length !== 6) {
    hex = "ffffff";
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return rgbToHsv(r, g, b);
}

function normalizeToHex(color: string): string {
  let hex = color || "#ffffff";
  if (hex === "transparent") {
    return "transparent";
  }
  if (hex === "default") {
    hex = "#f8f8f6";
  }
  hex = hex.replace("#", "").toLowerCase();
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length !== 6) {
    hex = "ffffff";
  }
  return "#" + hex;
}

export function ColorPickerPopover({
  color,
  opacity = 1,
  onChange,
  onClose,
  className,
  style,
}: ColorPickerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const alphaRef = useRef<HTMLDivElement>(null);

  // Derive initial HSV values
  const initialHsv = parseColorToHsv(color);
  
  const [hue, setHue] = useState(initialHsv.h);
  const [sat, setSat] = useState(initialHsv.s);
  const [val, setVal] = useState(initialHsv.v);
  const [alpha, setAlpha] = useState(color === "transparent" ? 0 : opacity);

  const [inputValue, setInputValue] = useState(
    color === "transparent" ? "Transparent" : (color === "default" ? "F8F8F6" : color.replace("#", "").toUpperCase())
  );

  // Sync state if color prop changes externally
  useEffect(() => {
    const normIncoming = normalizeToHex(color);
    const { r, g, b } = hsvToRgb(hue, sat, val);
    const currentHex = rgbToHex(r, g, b);
    const normCurrent = normalizeToHex(currentHex);

    if (normIncoming !== normCurrent || (color === "transparent" && alpha !== 0) || (color !== "transparent" && alpha === 0)) {
      const nextHsv = parseColorToHsv(color);
      setHue(nextHsv.h);
      setSat(nextHsv.s);
      setVal(nextHsv.v);
      
      const targetInputVal = color === "transparent" ? "Transparent" : (color === "default" ? "F8F8F6" : color.replace("#", "").toUpperCase());
      setInputValue(targetInputVal);
    }

    const targetAlpha = color === "transparent" ? 0 : opacity;
    if (Math.abs(alpha - targetAlpha) > 0.001) {
      setAlpha(targetAlpha);
    }
  }, [color, opacity]);

  const solidHex = (() => {
    const { r, g, b } = hsvToRgb(hue, sat, val);
    return rgbToHex(r, g, b);
  })();

  const triggerChange = (h: number, s: number, v: number, a: number) => {
    const { r, g, b } = hsvToRgb(h, s, v);
    const hex = rgbToHex(r, g, b);
    if (a === 0) {
      onChange("transparent", 0);
      setInputValue("Transparent");
    } else {
      onChange(hex, a);
      setInputValue(hex.replace("#", "").toUpperCase());
    }
  };

  // Drag handlers
  const handleSvPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!svRef.current) return;

    const update = (clientX: number, clientY: number) => {
      const rect = svRef.current!.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      const s = Math.round(x * 100);
      const v = Math.round((1 - y) * 100);
      setSat(s);
      setVal(v);
      triggerChange(hue, s, v, alpha);
    };

    update(e.clientX, e.clientY);

    const onPointerMove = (ev: PointerEvent) => {
      update(ev.clientX, ev.clientY);
    };
    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleHuePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!hueRef.current) return;

    const update = (clientX: number) => {
      const rect = hueRef.current!.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const h = Math.round(x * 360) % 360;
      setHue(h);
      triggerChange(h, sat, val, alpha);
    };

    update(e.clientX);

    const onPointerMove = (ev: PointerEvent) => {
      update(ev.clientX);
    };
    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleAlphaPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!alphaRef.current) return;

    const update = (clientX: number) => {
      const rect = alphaRef.current!.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const a = Math.round(x * 100) / 100;
      setAlpha(a);
      triggerChange(hue, sat, val, a);
    };

    update(e.clientX);

    const onPointerMove = (ev: PointerEvent) => {
      update(ev.clientX);
    };
    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Close popover when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        // Prevent closing if we click the toggle swatch itself
        const isSwatch = (e.target as HTMLElement).closest(".color-swatch-trigger");
        if (!isSwatch) {
          onClose();
        }
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [onClose]);

  return createPortal(
    <div
      ref={popoverRef}
      className={cn(
        "fixed z-[5500] flex flex-col w-[230px] p-3 gap-3 select-none canvas-floating-panel",
        "bg-color-mix(in srgb, var(--app-panel) 95%, transparent) border border-[var(--bone-12)] rounded-[12px] shadow-[0_4px_12px_rgba(0,0,0,0.12)] backdrop-blur-[20px]",
        className
      )}
      style={{
        background: "color-mix(in srgb, var(--app-panel) 95%, transparent)",
        ...style,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--bone-10)] pb-1.5 flex-shrink-0">
        <span className="text-[11px] font-semibold text-[var(--bone-100)] tracking-wide">Custom Color</span>
        <button
          onClick={onClose}
          className="p-0.5 rounded-[var(--radius-small)] text-[var(--bone-40)] hover:text-[var(--bone-100)] hover:bg-[var(--app-dark)]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Saturation/Value Area */}
      <div
        ref={svRef}
        onPointerDown={handleSvPointerDown}
        className="w-full h-[120px] rounded-[6px] relative cursor-crosshair overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))`,
        }}
      >
        {/* SV cursor indicator */}
        <div
          className="absolute w-3 h-3 rounded-full border-2 border-white shadow-[0_1px_3px_rgba(0,0,0,0.4)] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            left: `${sat}%`,
            top: `${100 - val}%`,
          }}
        />
      </div>

      {/* Sliders Container */}
      <div className="flex flex-col gap-2.5">
        {/* Hue Slider */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[9px] text-[var(--bone-40)]">
            <span>Hue</span>
            <span>{hue}°</span>
          </div>
          <div
            ref={hueRef}
            onPointerDown={handleHuePointerDown}
            className="w-full h-2.5 rounded-full relative cursor-ew-resize"
            style={{
              backgroundImage:
                "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
            }}
          >
            <div
              className="absolute w-3.5 h-3.5 rounded-full border-2 border-white bg-current shadow-[0_1px_3px_rgba(0,0,0,0.3)] -translate-x-1/2 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                left: `${(hue / 360) * 100}%`,
                color: `hsl(${hue}, 100%, 50%)`,
              }}
            />
          </div>
        </div>

        {/* Opacity Slider */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[9px] text-[var(--bone-40)]">
            <span>Opacity</span>
            <span>{Math.round(alpha * 100)}%</span>
          </div>
          <div
            ref={alphaRef}
            onPointerDown={handleAlphaPointerDown}
            className="w-full h-2.5 rounded-full relative cursor-ew-resize overflow-hidden border border-[var(--bone-10)]"
          >
            {/* Checkerboard track background overlay */}
            <div
              className="absolute inset-0 z-0"
              style={{
                backgroundImage:
                  "repeating-conic-gradient(var(--bone-10) 0% 25%, transparent 0% 50%)",
                backgroundSize: "6px 6px",
              }}
            />
            {/* Opacity color gradient overlay */}
            <div
              className="absolute inset-0 z-10"
              style={{
                backgroundImage: `linear-gradient(to right, transparent, ${solidHex})`,
              }}
            />
            {/* Handle container */}
            <div className="absolute inset-0 z-20 pointer-events-none">
              <div
                className="absolute w-3.5 h-3.5 rounded-full border-2 border-white bg-current shadow-[0_1px_3px_rgba(0,0,0,0.3)] -translate-x-1/2 top-1/2 -translate-y-1/2"
                style={{
                  left: `${alpha * 100}%`,
                  color: solidHex,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Hex/Opacity Values Inputs */}
      <div className="flex items-center gap-2 border-t border-[var(--bone-10)] pt-2.5">
        {/* Hex input */}
        <div className="flex-1 flex items-center h-7 bg-[var(--bone-6)] rounded-[var(--radius-small)] px-2 gap-1 border border-transparent focus-within:border-[var(--bone-15)]">
          <span className="text-[10px] text-[var(--bone-30)] font-mono font-semibold">#</span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              const inputVal = e.target.value;
              setInputValue(inputVal);
              if (inputVal.toLowerCase() === "transparent" || inputVal.toLowerCase() === "transp") {
                setAlpha(0);
                triggerChange(hue, sat, val, 0);
              } else {
                const clean = inputVal.replace(/[^0-9a-fA-F]/g, "");
                if (clean.length === 6 || clean.length === 3) {
                  const formatted = clean.length === 3 
                    ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2] 
                    : clean;
                  const nextHsv = parseColorToHsv("#" + formatted);
                  setHue(nextHsv.h);
                  setSat(nextHsv.s);
                  setVal(nextHsv.v);
                  if (alpha === 0) setAlpha(1);
                  triggerChange(nextHsv.h, nextHsv.s, nextHsv.v, alpha === 0 ? 1 : alpha);
                }
              }
            }}
            onBlur={() => {
              if (color === "transparent") {
                setInputValue("Transparent");
              } else {
                const { r, g, b } = hsvToRgb(hue, sat, val);
                const hex = rgbToHex(r, g, b);
                setInputValue(hex.replace("#", "").toUpperCase());
              }
            }}
            className={cn(
              "w-full bg-transparent border-none outline-none text-[11px] font-mono text-[var(--bone-90)] focus:text-[var(--bone-100)] p-0 m-0",
              color !== "transparent" && "uppercase"
            )}
          />
        </div>

        {/* Opacity percentage input */}
        <div className="w-[60px] flex items-center h-7 bg-[var(--bone-6)] rounded-[var(--radius-small)] px-2 gap-0.5 border border-transparent focus-within:border-[var(--bone-15)]">
          <input
            type="text"
            value={Math.round(alpha * 100)}
            onChange={(e) => {
              const text = e.target.value.replace(/[^0-9]/g, "");
              const opacityVal = Math.min(100, Math.max(0, parseInt(text) || 0));
              const nextAlpha = opacityVal / 100;
              setAlpha(nextAlpha);
              triggerChange(hue, sat, val, nextAlpha);
            }}
            className="w-full bg-transparent border-none outline-none text-[11px] text-[var(--bone-90)] focus:text-[var(--bone-100)] text-right p-0 m-0 font-mono"
          />
          <span className="text-[10px] text-[var(--bone-30)] font-semibold">%</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
