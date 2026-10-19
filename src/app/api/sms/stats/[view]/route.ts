import { and, count, desc, eq, inArray, isNotNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { clients, smsMessages, smsNumbers, smsRanges } from "@/db/schema";
import { fail, ok, requireAuth } from "@/lib/http";
import { assignedNumberIds, isAdmin } from "@/lib/scope";

export const dynamic = "force-dynamic";

type View = "overview" | "ranges" | "numbers" | "clients";

/**
 * Aggregated SMS statistics.
 *   /api/sms/stats/overview  → daily series + status totals (14 days)
 *   /api/sms/stats/ranges    → throughput per range (revenue: admin only)
 *   /api/sms/stats/numbers   → top numbers by volume
 *   /api/sms/stats/clients   → per-client volume & payout exposure (admin only)
 *
 * User edition: non-admin accounts only ever see aggregates over their own
 * assigned numbers, and never see revenue figures.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ view: string }> }) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { view } = (await params) as { view: View };
  const admin = isAdmin(auth.user!);

  let ownIds: number[] = [];
  let ownRangeIds: number[] = [];
  if (!admin) {
    if (view === "clients") return fail("Client exposure analytics are admin-only.", 403);
    ownIds = await assignedNumberIds(auth.user!.id);
    if (ownIds.length === 0) return ok({ series: [], totals: { total: 0, hits: 0 }, rows: [] });
    const rangeRows = await db
      .selectDistinct({ rangeId: smsNumbers.rangeId })
      .from(smsNumbers)
      .where(and(inArray(smsNumbers.id, ownIds), isNotNull(smsNumbers.rangeId)));
    ownRangeIds = rangeRows.map((r) => r.rangeId!).filter((v) => v !== null);
  }

  const ownMsg: SQL | undefined = ownIds.length ? inArray(smsMessages.numberId, ownIds) : undefined;
  const live = ownMsg ? and(eq(smsMessages.isTest, false), ownMsg) : eq(smsMessages.isTest, false);

  if (view === "overview") {
    const [series, totals] = await Promise.all([
      db
        .select({
          day: sql<string>`to_char(${smsMessages.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`,
          received: count(),
          hits: sql<number>`count(${smsMessages.otpCode})`,
          ...(admin ? { revenue: sql<string>`coalesce(sum(${smsMessages.rate}), 0)` } : {}),
        })
        .from(smsMessages)
        .where(live)
        .groupBy(sql`1`)
        .orderBy(sql`1`),
      db
        .select({
          total: count(),
          hits: sql<number>`count(${smsMessages.otpCode})`,
          ...(admin
            ? {
                revenueUsd: sql<string>`coalesce(sum(case when ${smsMessages.currency} = 'USD' then ${smsMessages.rate} end), 0)`,
                revenueEur: sql<string>`coalesce(sum(case when ${smsMessages.currency} = 'EUR' then ${smsMessages.rate} end), 0)`,
                revenueEgp: sql<string>`coalesce(sum(case when ${smsMessages.currency} = 'EGP' then ${smsMessages.rate} end), 0)`,
              }
            : {}),
        })
        .from(smsMessages)
        .where(live),
    ]);
    return ok({ series, totals: totals[0] });
  }

  if (view === "ranges") {
    const rows = await db
      .select({
        id: smsRanges.id,
        name: smsRanges.name,
        prefix: smsRanges.prefix,
        country: smsRanges.country,
        currency: smsRanges.currency,
        received: count(smsMessages.id),
        hits: sql<number>`count(${smsMessages.otpCode})`,
        ...(admin ? { revenue: sql<string>`coalesce(sum(${smsMessages.rate}), 0)` } : {}),
      })
      .from(smsRanges)
      .leftJoin(smsMessages, and(eq(smsMessages.rangeId, smsRanges.id), ...liveToFilters(live)))
      .where(!admin && ownRangeIds.length ? inArray(smsRanges.id, ownRangeIds) : undefined)
      .groupBy(smsRanges.id)
      .orderBy(desc(count(smsMessages.id)))
      .limit(100);
    return ok({ rows });
  }

  if (view === "numbers") {
    const rows = await db
      .select({
        id: smsNumbers.id,
        msisdn: smsNumbers.msisdn,
        status: smsNumbers.status,
        rangeName: smsRanges.name,
        received: count(smsMessages.id),
        hits: sql<number>`count(${smsMessages.otpCode})`,
        ...(admin ? { revenue: sql<string>`coalesce(sum(${smsMessages.rate}), 0)` } : {}),
        lastMessageAt: sql<string | null>`max(${smsMessages.createdAt})`,
      })
      .from(smsNumbers)
      .leftJoin(smsMessages, and(eq(smsMessages.numberId, smsNumbers.id), eq(smsMessages.isTest, false)))
      .leftJoin(smsRanges, eq(smsNumbers.rangeId, smsRanges.id))
      .where(ownIds.length ? inArray(smsNumbers.id, ownIds) : undefined)
      .groupBy(smsNumbers.id, smsRanges.name)
      .orderBy(desc(count(smsMessages.id)))
      .limit(100);
    return ok({ rows });
  }

  if (view === "clients") {
    const rows = await db
      .select({
        id: clients.id,
        name: clients.name,
        company: clients.company,
        status: clients.status,
        received: count(smsMessages.id),
        hits: sql<number>`count(${smsMessages.otpCode})`,
        revenue: sql<string>`coalesce(sum(${smsMessages.rate}), 0)`,
      })
      .from(clients)
      .leftJoin(smsMessages, eq(smsMessages.clientId, clients.id))
      .groupBy(clients.id)
      .orderBy(desc(count(smsMessages.id)))
      .limit(100);
    return ok({ rows });
  }

  return ok({ rows: [], note: "Unknown stats view." }, 404);
}

/** Flatten the live filter into a list of conditions for join clauses. */
function liveToFilters(live: SQL | undefined): SQL[] {
  return live ? [live] : [];
}
