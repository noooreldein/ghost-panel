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

/**
 * Build the runtime override CSS for the blue family based on a primary hex.
 *
 * Tailwind v4 utilities resolve through CSS variables, so overriding the
 * blue ramp recolors the whole panel. Tints and shades are derived with
 * color-mix in the OkLab gamut, which keeps hues true and tints clean on
 * light backgrounds (no neon 50/100 steps, no hue drift on dark shades).
 * The sky accents (chart highlights, login art) follow the same primary
 * so the whole identity stays coherent.
 */
export function themeCss(primaryColor: string): string {
  const primary = (primaryColor || "").trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(primary)) return ""; // nothing valid to apply
  if (primary === "#2563eb") return ""; // ghost default == the native blue ramp
  const tint = (pct: number) => `color-mix(in oklch, ${primary} ${pct}%, white)`;
  const shade = (pct: number) => `color-mix(in oklch, ${primary} ${pct}%, black)`;
  const v = [
    `--color-blue-50:${tint(7)}`,
    `--color-blue-100:${tint(14)}`,
    `--color-blue-200:${tint(28)}`,
    `--color-blue-300:${tint(44)}`,
    `--color-blue-400:${tint(62)}`,
    `--color-blue-500:${tint(82)}`,
    `--color-blue-600:${primary}`,
    `--color-blue-700:${shade(14)}`,
    `--color-blue-800:${shade(28)}`,
    `--color-blue-900:${shade(44)}`,
    `--color-blue-950:${shade(60)}`,
    `--color-sky-300:${tint(30)}`,
    `--color-sky-400:${tint(45)}`,
  ];
  return `:root{${v.join(";")};}`;
}

/** Resolve effective primary color: theme key wins unless a custom color is set. */
export function resolveTheme(settings: ResolvedSettings): ThemeDef {
  const byKey = THEMES.find((t) => t.key === settings.theme);
  if (byKey && byKey.key !== "custom") return byKey;
  return { key: "custom", label: "Custom", desc: "Custom accent color", primary: settings.primaryColor || "#2563eb", swatch: ["#f1f5f9", settings.primaryColor || "#2563eb", "#38bdf8"] };
}
