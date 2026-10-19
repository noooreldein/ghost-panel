/**
 * Ghost Panel theme engine — merged from the Flash/Panel-sma white-label system.
 *
 * Tailwind v4 utilities resolve colors through CSS variables
 * (`bg-blue-600` -> `var(--color-blue-600)`), so a runtime `<style>` tag that
 * overrides the blue family recolors the whole panel: buttons, sidebar active
 * states, badges, focus rings and the login art gradient.
 *
 * The default "ghost" identity is the original Ghost Panel blue and emits no
 * overrides; the other accents were ported from the Flash panel theme gallery.
 */

export interface ThemeDef {
  key: string;
  label: string;
  desc: string;
  /** base accent hex, equals the effective blue-600 */
  primary: string;
  swatch: [string, string, string];
}

export const THEMES: ThemeDef[] = [
  {
    key: "ghost",
    label: "Ghost (Default)",
    desc: "The original Ghost Panel identity: deep blue on a clean daylight surface.",
    primary: "#2563eb",
    swatch: ["#f1f5f9", "#2563eb", "#38bdf8"],
  },
  {
    key: "indigo",
    label: "Indigo",
    desc: "The classic Flash indigo/cyan look — calm and businesslike.",
    primary: "#4f46e5",
    swatch: ["#eef2ff", "#4f46e5", "#38bdf8"],
  },
  {
    key: "violet",
    label: "Violet Midnight",
    desc: "Violet accents with an electric feel. Sharp and premium.",
    primary: "#8b5cf6",
    swatch: ["#f5f3ff", "#8b5cf6", "#22d3ee"],
  },
  {
    key: "emerald",
    label: "Emerald",
    desc: "Calm green/teal accents for a fresh, minimal console.",
    primary: "#10b981",
    swatch: ["#ecfdf5", "#10b981", "#34d399"],
  },
  {
    key: "sunset",
    label: "Sunset",
    desc: "Warm orange/pink accents borrowed from the Flash sunset theme.",
    primary: "#f97316",
    swatch: ["#fff7ed", "#f97316", "#ec4899"],
  },
  {
    key: "crimson",
    label: "Crimson",
    desc: "Bold red/amber accents. Dramatic and high-contrast.",
    primary: "#dc2626",
    swatch: ["#fef2f2", "#dc2626", "#f59e0b"],
  },
  {
    key: "cyan",
    label: "Cyan Signal",
    desc: "Bright cyan/blue accents with a technical, carrier-grade feel.",
    primary: "#0891b2",
    swatch: ["#ecfeff", "#0891b2", "#22d3ee"],
  },
];

export interface ResolvedSettings {
  panelName: string;
  primaryColor: string;
  theme: string;
}

/* ---- color math ------------------------------------------------- */

function hexToHsl(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [221, 83, 54]; // default blue-600 hsl
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      default:
        h = ((r - g) / d + 4) * 60;
    }
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function hsl(h: number, s: number, l: number): string {
  const sc = Math.min(Math.max(s, 0), 100);
  const lc = Math.min(Math.max(l, 0), 100);
  return `hsl(${h} ${sc}% ${lc}%)`;
}

/**
 * Build the runtime override CSS for the blue family based on a primary hex.
 * Lightness ladder approximates Tailwind's blue ramp:
 *   50 -> 96, 100 -> 91, 300 -> 77, 500 -> 62, 600 -> base, 700 -> -7, 800 -> -13, 950 -> 15
 */
export function themeCss(primaryColor: string): string {
  const [h, s, baseL] = hexToHsl(primaryColor);
  if (s === 0 && h === 221 && baseL === 54) return ""; // default ghost blue
  const l = (delta: number) => Math.min(Math.max(baseL + delta, 0), 100);
  return `:root{--color-blue-50:${hsl(h, s, 96)};--color-blue-100:${hsl(h, s, 91)};--color-blue-300:${hsl(
    h,
    s,
    77
  )};--color-blue-500:${hsl(h, s, 62)};--color-blue-600:${hsl(h, s, baseL)};--color-blue-700:${hsl(
    h,
    s,
    l(-7)
  )};--color-blue-800:${hsl(h, s, l(-13))};--color-blue-950:${hsl(h, s, 15)};}`;
}

/** Resolve effective primary color: theme key wins unless a custom color is set. */
export function resolveTheme(settings: ResolvedSettings): ThemeDef {
  const byKey = THEMES.find((t) => t.key === settings.theme);
  if (byKey && byKey.key !== "custom") return byKey;
  return { key: "custom", label: "Custom", desc: "Custom accent color", primary: settings.primaryColor || "#2563eb", swatch: ["#f1f5f9", settings.primaryColor || "#2563eb", "#38bdf8"] };
}
