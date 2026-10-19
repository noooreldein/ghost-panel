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

/** Read the white-label singleton (id = 1), self-healing to Ghost defaults. */
export async function getPanelSettings(): Promise<ResolvedPanelSettings> {
  try {
    const rows: PanelSettings[] = await db.select().from(panelSettings).limit(1);
    const row = rows[0];
    if (!row) return FALLBACK;
    const theme = THEMES.find((t) => t.key === row.theme);
    return {
      panelName: row.panelName || FALLBACK.panelName,
      primaryColor: theme ? theme.primary : row.primaryColor || FALLBACK.primaryColor,
      theme: row.theme || FALLBACK.theme,
      themeLabel: theme ? theme.label : "Custom",
    };
  } catch {
    return FALLBACK;
  }
}
