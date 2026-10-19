import { and, count, desc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { smsMessages } from "@/db/schema";
import { ok, requireAuth } from "@/lib/http";

export const dynamic = "force-dynamic";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const today = startOfToday();
  const weekAgo = new Date(today.getTime() - 6 * 86400000);
  const twoWeeksAgo = new Date(today.getTime() - 13 * 86400000);
  const live = eq(smsMessages.isTest, false);

  const [todayCount, weekHits, lastWeekHits, statusBreakdown, series, recent] = await Promise.all([
    db.select({ value: count() }).from(smsMessages).where(and(live, gte(smsMessages.createdAt, today))),
    db
      .select({ value: count() })
      .from(smsMessages)
      .where(and(live, gte(smsMessages.createdAt, weekAgo), isNotNull(smsMessages.otpCode))),
    db
      .select({ value: count() })
      .from(smsMessages)
      .where(
        and(live, gte(smsMessages.createdAt, twoWeeksAgo), lt(smsMessages.createdAt, weekAgo), isNotNull(smsMessages.otpCode))
      ),
    db
      .select({ status: smsMessages.status, value: count() })
      .from(smsMessages)
      .where(and(live, gte(smsMessages.createdAt, weekAgo)))
      .groupBy(smsMessages.status),
    db
      .select({
        day: sql<string>`to_char(${smsMessages.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`,
        received: count(),
        hits: sql<number>`count(${smsMessages.otpCode})`,
      })
      .from(smsMessages)
      .where(and(live, gte(smsMessages.createdAt, weekAgo)))
      .groupBy(sql`1`),
    db
      .select({
        id: smsMessages.id,
        msisdn: smsMessages.msisdn,
        senderId: smsMessages.senderId,
        otpCode: smsMessages.otpCode,
        status: smsMessages.status,
        supplier: smsMessages.supplier,
        createdAt: smsMessages.createdAt,
      })
      .from(smsMessages)
      .where(live)
      .orderBy(desc(smsMessages.id))
      .limit(6),
  ]);

  const week = weekHits[0]?.value ?? 0;
  const lastWeek = lastWeekHits[0]?.value ?? 0;
  const trendPct = lastWeek === 0 ? null : Math.round(((week - lastWeek) / lastWeek) * 1000) / 10;

  return ok({
    todayCount: todayCount[0]?.value ?? 0,
    weekHits: week,
    lastWeekHits: lastWeek,
    trendPct,
    statusBreakdown,
    series,
    recent: recent.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    balances: { USD: auth.user!.balanceUsd, EUR: auth.user!.balanceEur, EGP: auth.user!.balanceEgp },
  });
}
