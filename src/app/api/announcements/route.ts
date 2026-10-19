import { desc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { announcements } from "@/db/schema";
import { audit } from "@/lib/audit";
import { fail, ok, requireAuth, str } from "@/lib/http";

export const dynamic = "force-dynamic";
const TONES = ["info", "success", "warning", "critical"];
const AUDIENCES = ["all", "admin", "user", "supplier"];

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const where = auth.user!.role === "admin"
    ? undefined
    : or(eq(announcements.status, "published"), eq(announcements.audience, auth.user!.role));
  const rows = await db.select().from(announcements).where(where).orderBy(desc(announcements.publishedAt), desc(announcements.id)).limit(100);
  const visible = auth.user!.role === "admin" ? rows : rows.filter((row) => row.status === "published" && (row.audience === "all" || row.audience === auth.user!.role));
  return ok({ announcements: visible });
}

export async function POST(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => ({}));
  const title = str(body.title);
  const message = str(body.body);
  const tone = str(body.tone) || "info";
  const audience = str(body.audience) || "all";
  if (!title || title.length > 180) return fail("العنوان مطلوب ويجب ألا يتجاوز 180 حرفًا.");
  if (!message || message.length > 4000) return fail("نص الإشعار مطلوب ويجب ألا يتجاوز 4000 حرف.");
  if (!TONES.includes(tone) || !AUDIENCES.includes(audience)) return fail("نوع أو جمهور الإشعار غير صالح.");
  const [announcement] = await db.insert(announcements).values({ title, body: message, tone, audience, status: "published", createdBy: auth.user!.id, publishedAt: new Date() }).returning();
  await audit(auth.user!.id, "announcement.published", "announcement", announcement.id, { title, tone, audience });
  return ok({ announcement }, 201);
}

export async function PATCH(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  const status = str(body.status);
  if (!Number.isInteger(id) || id < 1 || !["published", "archived"].includes(status)) return fail("بيانات الإشعار غير صالحة.");
  const [announcement] = await db.update(announcements).set({ status, publishedAt: status === "published" ? new Date() : undefined }).where(eq(announcements.id, id)).returning();
  if (!announcement) return fail("الإشعار غير موجود.", 404);
  await audit(auth.user!.id, `announcement.${status}`, "announcement", id, { title: announcement.title });
  return ok({ announcement });
}
