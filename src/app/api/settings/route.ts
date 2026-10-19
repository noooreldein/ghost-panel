import { eq } from "drizzle-orm";
import { db } from "@/db";
import { panelSettings } from "@/db/schema";
import { bustPanelSettingsCache } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { getSessionUser, toSafeUser } from "@/lib/auth";
import { fail, ok, requireAuth, str } from "@/lib/http";
import { getPanelSettings } from "@/lib/settings";
import { THEMES } from "@/lib/theme";

export const dynamic = "force-dynamic";

/**
 * Session + branding read. Returns the signed-in user (null when signed out)
 * plus the white-label settings and the theme gallery. `useMe()` depends on
 * the `user` field; the theme registry powers the branding admin page.
 */
export async function GET() {
  const user = await getSessionUser();
  const settings = await getPanelSettings();
  return ok({
    user: user ? toSafeUser(user) : null,
    settings,
    themes: THEMES,
  });
}

/** Update the white-label identity (admin only). */
export async function PATCH(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const panelName = str(body.panelName);
  const theme = str(body.theme);
  const primaryColor = str(body.primaryColor);

  if (panelName && panelName.length > 100) return fail("Panel name is too long (max 100).");
  if (theme && !["custom", ...THEMES.map((t) => t.key)].includes(theme)) return fail("Unknown theme.");
  if (primaryColor && !/^#[0-9a-f]{6}$/i.test(primaryColor)) return fail("Primary color must be a hex value like #2563eb.");

  // A named theme carries its own primary color; keep the two in sync.
  const named = THEMES.find((t) => t.key === theme);
  const resolvedColor = named ? named.primary : primaryColor;

  const existing = await db.select({ id: panelSettings.id }).from(panelSettings).limit(1);
  let row;
  if (existing[0]) {
    [row] = await db
      .update(panelSettings)
      .set({
        ...(panelName ? { panelName } : {}),
        ...(theme ? { theme } : {}),
        ...(resolvedColor ? { primaryColor: resolvedColor } : {}),
        updatedAt: new Date(),
      })
      .where(eq(panelSettings.id, existing[0].id))
      .returning();
  } else {
    [row] = await db
      .insert(panelSettings)
      .values({
        panelName: panelName || "Ghost Panel",
        theme: theme || "ghost",
        primaryColor: resolvedColor || "#2563eb",
      })
      .returning();
  }

  bustPanelSettingsCache(); // apply the new identity immediately, not after TTL
  await audit(auth.user!.id, "settings.branding", "panel_settings", String(row.id), {
    panelName: row.panelName,
    theme: row.theme,
    primaryColor: row.primaryColor,
  });
  return ok({ row, themes: THEMES });
}
