import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { smsProviders } from "@/db/schema";
import { audit } from "@/lib/audit";
import { encryptProviderSecret } from "@/lib/provider-secrets";
import { fail, ok, requireAuth, str } from "@/lib/http";

export const dynamic = "force-dynamic";
const PROTOCOLS = ["http_rest", "smpp", "smpp_tls", "webhook", "soap"] as const;
const MIN_INTERVAL = 5;
const MAX_INTERVAL = 3600;

export async function GET() {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  const providers = await db.select().from(smsProviders).orderBy(smsProviders.priority, desc(smsProviders.createdAt));
  return ok({ providers: providers.map(({ credentials, ...provider }) => ({ ...provider, credentialsSet: Boolean(credentials) })) });
}

export async function POST(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => ({}));
  const name = str(body.name);
  const protocol = str(body.protocol);
  const endpoint = str(body.endpoint);
  if (!name || name.length > 128) return fail("اسم المزود مطلوب (حتى 128 حرفًا).");
  if (!(PROTOCOLS as readonly string[]).includes(protocol)) return fail("بروتوكول غير مدعوم.");
  if (endpoint) {
    try {
      const url = new URL(endpoint);
      if (!["http:", "https:", "smpp:", "smpps:"].includes(url.protocol)) throw new Error();
    } catch { return fail("عنوان الاتصال غير صالح."); }
  }
  const priority = Number(body.priority ?? 100);
  if (!Number.isInteger(priority) || priority < 1 || priority > 9999) return fail("الأولوية يجب أن تكون بين 1 و9999.");
  const pollIntervalSeconds = Number(body.pollIntervalSeconds ?? 30);
  if (!Number.isInteger(pollIntervalSeconds) || pollIntervalSeconds < MIN_INTERVAL || pollIntervalSeconds > MAX_INTERVAL) {
    return fail(`فترة المراقبة يجب أن تكون بين ${MIN_INTERVAL} و${MAX_INTERVAL} ثانية.`);
  }
  const secret = str(body.secret);
  if (secret && process.env.NODE_ENV === "production" && !process.env.PROVIDER_ENCRYPTION_KEY) {
    return fail("يجب ضبط PROVIDER_ENCRYPTION_KEY في بيئة الإنتاج قبل حفظ بيانات الاعتماد.", 503);
  }
  const [provider] = await db.insert(smsProviders).values({
    name,
    protocol,
    endpoint: endpoint || null,
    username: str(body.username) || null,
    credentials: secret ? encryptProviderSecret(secret) : null,
    status: body.status === "paused" ? "paused" : "active",
    priority,
    pollIntervalSeconds,
    healthStatus: "not_checked",
  }).returning();
  await audit(auth.user!.id, "provider.created", "provider", provider.id, { name, protocol, endpoint: endpoint || null, priority, pollIntervalSeconds });
  const { credentials, ...safe } = provider;
  return ok({ provider: { ...safe, credentialsSet: Boolean(credentials) } }, 201);
}

export async function PATCH(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!Number.isInteger(id) || id < 1) return fail("معرّف المزود غير صالح.");
  const patch: Partial<typeof smsProviders.$inferInsert> = {};
  if (body.status !== undefined) {
    if (!["active", "paused"].includes(str(body.status))) return fail("حالة غير صالحة.");
    patch.status = str(body.status);
  }
  if (body.priority !== undefined) {
    const priority = Number(body.priority);
    if (!Number.isInteger(priority) || priority < 1 || priority > 9999) return fail("الأولوية يجب أن تكون بين 1 و9999.");
    patch.priority = priority;
  }
  if (body.pollIntervalSeconds !== undefined) {
    const pollIntervalSeconds = Number(body.pollIntervalSeconds);
    if (!Number.isInteger(pollIntervalSeconds) || pollIntervalSeconds < MIN_INTERVAL || pollIntervalSeconds > MAX_INTERVAL) {
      return fail(`فترة المراقبة يجب أن تكون بين ${MIN_INTERVAL} و${MAX_INTERVAL} ثانية.`);
    }
    patch.pollIntervalSeconds = pollIntervalSeconds;
  }
  if (!Object.keys(patch).length) return fail("لا توجد تغييرات.");
  const [provider] = await db.update(smsProviders).set(patch).where(eq(smsProviders.id, id)).returning();
  if (!provider) return fail("المزود غير موجود.", 404);
  await audit(auth.user!.id, "provider.updated", "provider", provider.id, {
    status: patch.status,
    priority: patch.priority,
    pollIntervalSeconds: patch.pollIntervalSeconds,
  });
  const { credentials, ...safe } = provider;
  return ok({ provider: { ...safe, credentialsSet: Boolean(credentials) } });
}

export async function DELETE(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) return fail("معرّف المزود غير صالح.");
  const [deleted] = await db.delete(smsProviders).where(eq(smsProviders.id, id)).returning({ id: smsProviders.id, name: smsProviders.name });
  if (!deleted) return fail("المزود غير موجود.", 404);
  await audit(auth.user!.id, "provider.deleted", "provider", deleted.id, { name: deleted.name });
  return ok({ id: deleted.id });
}
