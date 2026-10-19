import { eq } from "drizzle-orm";
import { db } from "@/db";
import { smsProviders } from "@/db/schema";
import { audit } from "@/lib/audit";
import { fail, ok, requireAuth } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Validates a connection profile locally. It deliberately does not contact the
 * configured endpoint: provider endpoints may be private carrier networks and
 * a panel-side probe would turn this route into an SSRF primitive.
 */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return fail("معرّف المزود غير صالح.");

  const [provider] = await db.select().from(smsProviders).where(eq(smsProviders.id, id)).limit(1);
  if (!provider) return fail("المزود غير موجود.", 404);

  const problems: string[] = [];
  if (provider.status !== "active") problems.push("المزود متوقف حاليًا.");
  if (!provider.endpoint) problems.push("عنوان الاتصال غير مضبوط.");
  if (["http_rest", "smpp", "smpp_tls", "soap"].includes(provider.protocol) && !provider.credentials) {
    problems.push("بيانات الاعتماد غير محفوظة.");
  }
  if (provider.endpoint) {
    try {
      const url = new URL(provider.endpoint);
      const expected = provider.protocol === "smpp" ? ["smpp:"] : provider.protocol === "smpp_tls" ? ["smpps:"] : ["http:", "https:"];
      if (!expected.includes(url.protocol)) problems.push("نوع الرابط لا يتوافق مع البروتوكول المحدد.");
    } catch { problems.push("عنوان الاتصال غير صالح."); }
  }

  const healthStatus = problems.length ? "needs_attention" : "ready";
  const healthNote = problems.length ? problems.join(" ") : "الإعداد مكتمل وجاهز للربط مع محول البروتوكول.";
  const [updated] = await db.update(smsProviders).set({ healthStatus, healthNote, lastHealthCheckAt: new Date() }).where(eq(smsProviders.id, id)).returning();
  await audit(auth.user!.id, "provider.configuration_validated", "provider", id, { result: healthStatus, problems: problems.length });
  const { credentials, ...safe } = updated;
  return ok({ provider: { ...safe, credentialsSet: Boolean(credentials) }, result: healthStatus, note: healthNote });
}
