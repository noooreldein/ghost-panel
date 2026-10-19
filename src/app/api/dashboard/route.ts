import { and, count, desc, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { smsMessages } from "@/db/schema";
import { ok, requireAuth } from "@/lib/http";
import { assignedNumberIds, isAdmin } from "@/lib/scope";

export const dynamic = "force-dynamic";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Dashboard KPIs. Admins see platform-wide totals; the user edition is
 * scoped to the account's own assigned numbers and never exposes suppliers.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const admin = isAdmin(auth.user!);
  const today = startOfToday();
  const weekAgo = new Date(today.getTime() - 6 * 86400000);
  const twoWeeksAgo = new Date(today.getTime() - 13 * 86400000);

  let scopeFilter = eq(smsMessages.isTest, false);
  if (!admin) {
    const ids = await assignedNumberIds(auth.user!.id);
    if (ids.length === 0) {
      return ok({
        todayCount: 0,
        weekHits: 0,
        lastWeekHits: 0,
        trendPct: null,
        statusBreakdown: [],
        series: [],
        recent: [],
        balances: { USD: auth.user!.balanceUsd, EUR: auth.user!.balanceEur, EGP: auth.user!.balanceEgp },
      });
    }
    scopeFilter = and(eq(smsMessages.isTest, false), inArray(smsMessages.numberId, ids))!;
  }

  const [todayCount, weekHits, lastWeekHits, statusBreakdown, series, recent] = await Promise.all([
    db.select({ value: count() }).from(smsMessages).where(and(scopeFilter, gte(smsMessages.createdAt, today))),
    db
      .select({ value: count() })
      .from(smsMessages)
      .where(and(scopeFilter, gte(smsMessages.createdAt, weekAgo), isNotNull(smsMessages.otpCode))),
    db
      .select({ value: count() })
      .from(smsMessages)
      .where(and(scopeFilter, gte(smsMessages.createdAt, twoWeeksAgo), lt(smsMessages.createdAt, weekAgo), isNotNull(smsMessages.otpCode))),
    db
      .select({ status: smsMessages.status, value: count() })
      .from(smsMessages)
      .where(and(scopeFilter, gte(smsMessages.createdAt, weekAgo)))
      .groupBy(smsMessages.status),
    db
      .select({
        day: sql<string>`to_char(${smsMessages.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`,
        received: count(),
        hits: sql<number>`count(${smsMessages.otpCode})`,
      })
      .from(smsMessages)
      .where(and(scopeFilter, gte(smsMessages.createdAt, weekAgo)))
      .groupBy(sql`1`),
    db
      .select({
        id: smsMessages.id,
        msisdn: smsMessages.msisdn,
        senderId: smsMessages.senderId,
        otpCode: smsMessages.otpCode,
        status: smsMessages.status,
        ...(admin ? { supplier: smsMessages.supplier } : {}),
        createdAt: smsMessages.createdAt,
      })
      .from(smsMessages)
      .where(scopeFilter)
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
