import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, smsMessages, smsNumbers, smsRanges } from "@/db/schema";
import { ok, requireAuth } from "@/lib/http";

export const dynamic = "force-dynamic";

type View = "overview" | "ranges" | "numbers" | "clients";

/**
 * Aggregated SMS statistics.
 *   /api/sms/stats/overview  → daily series + status totals (14 days)
 *   /api/sms/stats/ranges    → throughput / revenue per range
 *   /api/sms/stats/numbers   → top numbers by volume
 *   /api/sms/stats/clients   → per-client volume & payout exposure
 */
export async function GET(_req: Request, { params }: { params: Promise<{ view: string }> }) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { view } = await params as { view: View };
  const live = eq(smsMessages.isTest, false);

  if (view === "overview") {
    const [series, totals] = await Promise.all([
      db
        .select({
          day: sql<string>`to_char(${smsMessages.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`,
          received: count(),
          hits: sql<number>`count(${smsMessages.otpCode})`,
          revenue: sql<string>`coalesce(sum(${smsMessages.rate}), 0)`,
        })
        .from(smsMessages)
        .where(live)
        .groupBy(sql`1`)
        .orderBy(sql`1`),
      db
        .select({
          total: count(),
          hits: sql<number>`count(${smsMessages.otpCode})`,
          revenueUsd: sql<string>`coalesce(sum(case when ${smsMessages.currency} = 'USD' then ${smsMessages.rate} end), 0)`,
          revenueEur: sql<string>`coalesce(sum(case when ${smsMessages.currency} = 'EUR' then ${smsMessages.rate} end), 0)`,
          revenueEgp: sql<string>`coalesce(sum(case when ${smsMessages.currency} = 'EGP' then ${smsMessages.rate} end), 0)`,
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
        revenue: sql<string>`coalesce(sum(${smsMessages.rate}), 0)`,
      })
      .from(smsRanges)
      .leftJoin(smsMessages, eq(smsMessages.rangeId, smsRanges.id))
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
        revenue: sql<string>`coalesce(sum(${smsMessages.rate}), 0)`,
        lastMessageAt: sql<string | null>`max(${smsMessages.createdAt})`,
      })
      .from(smsNumbers)
      .leftJoin(smsMessages, eq(smsMessages.numberId, smsNumbers.id))
      .leftJoin(smsRanges, eq(smsNumbers.rangeId, smsRanges.id))
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
