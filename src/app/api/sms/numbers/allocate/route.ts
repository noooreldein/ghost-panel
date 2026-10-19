import { and, count, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { agentRangeLimits, clients, smsNumbers, smsRanges, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { fail, ok, requireAuth } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Assign or reclaim a selected inventory group. No messages or history are deleted. */
export async function POST(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => ({}));
  const parsedIds: unknown[] = Array.isArray(body.numberIds) ? body.numberIds.map(Number) : [];
  const numberIds = [...new Set(parsedIds.filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0))];
  const clientId = body.clientId === null || body.clientId === "" ? null : Number(body.clientId);
  const userId = body.userId === null || body.userId === "" ? null : Number(body.userId);
  const onlyUnassigned = body.onlyUnassigned === true;

  if (!numberIds.length || numberIds.length > 500) return fail("اختر من 1 إلى 500 رقم.");
  if (clientId !== null && (!Number.isInteger(clientId) || clientId < 1)) return fail("العميل غير صالح.");
  if (userId !== null && (!Number.isInteger(userId) || userId < 1)) return fail("الحساب غير صالح.");
  if (clientId && userId) return fail("لا يمكن تخصيص الرقم لعميل وحساب في نفس الوقت.");

  if (clientId) {
    const [client] = await db.select({ id: clients.id, name: clients.name }).from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!client) return fail("العميل غير موجود.", 404);
  }
  if (userId) {
    const [target] = await db.select({ id: users.id, username: users.username, status: users.status }).from(users).where(eq(users.id, userId)).limit(1);
    if (!target) return fail("الحساب غير موجود.", 404);
    if (target.status !== "active") return fail("الحساب موقوف ولا يمكن تخصيص أرقام له.");
  }

  /* --- daily-limit enforcement (merged from the Flash agent-limit book) --- */
  if (userId) {
    const rows = await db
      .select({
        numberId: smsNumbers.id,
        rangeId: smsNumbers.rangeId,
        assignedUserId: smsNumbers.assignedUserId,
      })
      .from(smsNumbers)
      .where(inArray(smsNumbers.id, numberIds));

    const selected = onlyUnassigned ? rows.filter((r) => r.assignedUserId === null) : rows;
    const rangeIds = [...new Set(selected.map((r) => r.rangeId).filter((v): v is number => typeof v === "number"))];

    // today's count already assigned to this user (any range)
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const [todayRow] = await db
      .select({ value: count() })
      .from(smsNumbers)
      .where(and(eq(smsNumbers.assignedUserId, userId), gte(smsNumbers.assignedAt, startOfDay)));

    const limits = rangeIds.length
      ? await db.select().from(agentRangeLimits).where(and(eq(agentRangeLimits.userId, userId), inArray(agentRangeLimits.rangeId, rangeIds)))
      : [];
    const ranges = rangeIds.length
      ? await db.select({ id: smsRanges.id, dailyLimit: smsRanges.dailyLimit }).from(smsRanges).where(inArray(smsRanges.id, rangeIds))
      : [];

    let usedToday = todayRow?.value ?? 0;
    const rejections: { rangeId: number; reason: string }[] = [];
    let allowedIds: number[] = [];

    for (const rangeId of rangeIds) {
      const override = limits.find((l) => l.rangeId === rangeId);
      const range = ranges.find((r) => r.id === rangeId);
      const dailyLimit = override?.dailyLimit ?? range?.dailyLimit ?? 50;
      const inRange = selected.filter((r) => r.rangeId === rangeId).length;
      const remaining = Math.max(dailyLimit - usedToday, 0);
      if (inRange > remaining) {
        rejections.push({ rangeId, reason: `Daily limit reached (${usedToday}/${dailyLimit} assigned today on this range)` });
        continue;
      }
      usedToday += inRange;
      allowedIds.push(...selected.filter((r) => r.rangeId === rangeId).map((r) => r.numberId));
    }

    // ranges the numbers don't belong to (null rangeId) are always allowed
    allowedIds.push(...selected.filter((r) => r.rangeId === null).map((r) => r.numberId));

    if (!allowedIds.length && rejections.length) {
      return fail(`تم رفض التخصيص: ${rejections[0].reason}`, 429, { rejections });
    }

    const changed = await db
      .update(smsNumbers)
      .set({ assignedUserId: userId, assignedAt: sql`now()` })
      .where(inArray(smsNumbers.id, allowedIds))
      .returning({ id: smsNumbers.id });

    await audit(auth.user!.id, "numbers.assigned_user", "sms_numbers", null, {
      count: changed.length,
      userId,
      rejections,
    });
    return ok({ changed: changed.length, ids: changed.map((row) => row.id), rejections });
  }

  if (clientId !== null) {
    const where = onlyUnassigned ? and(inArray(smsNumbers.id, numberIds), isNull(smsNumbers.assignedClientId)) : inArray(smsNumbers.id, numberIds);
    const changed = await db.update(smsNumbers).set({ assignedClientId: clientId }).where(where).returning({ id: smsNumbers.id });
    await audit(auth.user!.id, clientId ? "numbers.assigned" : "numbers.reclaimed", "sms_numbers", null, { count: changed.length, clientId, onlyUnassigned });
    return ok({ changed: changed.length, ids: changed.map((row) => row.id) });
  }

  // reclaim to nobody
  const changed = await db
    .update(smsNumbers)
    .set({ assignedUserId: null, assignedAt: null })
    .where(inArray(smsNumbers.id, numberIds))
    .returning({ id: smsNumbers.id });
  await audit(auth.user!.id, "numbers.reclaimed", "sms_numbers", null, { count: changed.length, onlyUnassigned });
  return ok({ changed: changed.length, ids: changed.map((row) => row.id) });
}
