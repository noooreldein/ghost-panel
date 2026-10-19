import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, users } from "@/db/schema";
import { fail, ok, requireAuth, str } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  const url = new URL(req.url);
  const entityType = str(url.searchParams.get("entityType"));
  const requestedLimit = Number(url.searchParams.get("limit") ?? 12);
  const limit = Math.max(1, Math.min(Number.isInteger(requestedLimit) ? requestedLimit : 12, 100));
  if (entityType && !["provider", "announcement"].includes(entityType)) return fail("نوع السجل غير مدعوم.");

  const rows = await db
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      entityId: auditEvents.entityId,
      details: auditEvents.details,
      createdAt: auditEvents.createdAt,
      actorName: users.fullName,
      actorUsername: users.username,
    })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorId))
    .where(entityType ? eq(auditEvents.entityType, entityType) : undefined)
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit);
  return ok({ events: rows });
}
