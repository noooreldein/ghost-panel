import { db } from "@/db";
import { panelSettings, type PanelSettings } from "@/db/schema";
import { THEMES } from "@/lib/theme";

export interface ResolvedPanelSettings {
  panelName: string;
  primaryColor: string;
  theme: string;
  themeLabel: string;
}

const FALLBACK: ResolvedPanelSettings = { panelName: "Ghost Panel", primaryColor: "#2563eb", theme: "ghost", themeLabel: "Ghost (Default)" };

/**
 * Read the white-label singleton (id = 1), self-healing to Ghost defaults.
 *
 * Every layout render (page shell, login, metadata) resolves this, so the
 * value is memoized for a short window: a DB blip then serves the last
 * known identity instead of falling back mid-brownout, and normal traffic
 * stops paying a database round-trip per page view. Branding writes bust
 * the memo via bustPanelSettingsCache().
 */
let memo: { at: number; value: ResolvedPanelSettings } | null = null;
const MEMO_TTL_MS = 10_000;

export function bustPanelSettingsCache(): void {
  memo = null;
}

export async function getPanelSettings(): Promise<ResolvedPanelSettings> {
  if (memo && Date.now() - memo.at < MEMO_TTL_MS) return memo.value;
  let value: ResolvedPanelSettings;
  try {
    const rows: PanelSettings[] = await db.select().from(panelSettings).limit(1);
    const row = rows[0];
    if (!row) {
      value = FALLBACK;
    } else {
      const theme = THEMES.find((t) => t.key === row.theme);
      value = {
        panelName: row.panelName || FALLBACK.panelName,
        primaryColor: theme ? theme.primary : row.primaryColor || FALLBACK.primaryColor,
        theme: row.theme || FALLBACK.theme,
        themeLabel: theme ? theme.label : "Custom",
      };
    }
  } catch {
    // DB unreachable: last known identity is better than a surprise default.
    return memo?.value ?? FALLBACK;
  }
  memo = { at: Date.now(), value };
  return value;
}
