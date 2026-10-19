import { and, count, desc, eq, gte, ilike, lte, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { clients, smsMessages, smsRanges } from "@/db/schema";
import { csvResponse, ok, pagination, parseDateBoundary, requireAuth, str } from "@/lib/http";
import { messageVisibility, stripCommercial } from "@/lib/scope";

export const dynamic = "force-dynamic";

const selectFields = {
  id: smsMessages.id,
  msisdn: smsMessages.msisdn,
  senderId: smsMessages.senderId,
  body: smsMessages.body,
  otpCode: smsMessages.otpCode,
  status: smsMessages.status,
  latencyMs: smsMessages.latencyMs,
  rate: smsMessages.rate,
  payout: smsMessages.payout,
  currency: smsMessages.currency,
  supplier: smsMessages.supplier,
  isTest: smsMessages.isTest,
  direction: smsMessages.direction,
  destination: smsMessages.destination,
  createdAt: smsMessages.createdAt,
  rangeName: smsRanges.name,
  clientName: clients.name,
};

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const q = str(url.searchParams.get("q"));
  const status = str(url.searchParams.get("status"));
  const rangeId = str(url.searchParams.get("rangeId"));
  const scope = str(url.searchParams.get("scope")) || "live";
  const from = parseDateBoundary(url.searchParams.get("from"));
  const to = parseDateBoundary(url.searchParams.get("to"), true);

  /* --- user-edition scoping: non-admins see only their own numbers --- */
  const visibility = await messageVisibility(auth.user!);
  if (visibility.kind === "none") {
    return ok({ total: 0, page: 1, summary: {}, rows: [] });
  }

  const fields = stripCommercial(selectFields, auth.user!);

  const filters: SQL[] = [];
  if (visibility.kind === "own") filters.push(visibility.filter);
  if (scope === "live") filters.push(eq(smsMessages.isTest, false));
  if (scope === "test") filters.push(eq(smsMessages.isTest, true));
  if (q) filters.push(or(ilike(smsMessages.msisdn, `%${q}%`), ilike(smsMessages.body, `%${q}%`), ilike(smsMessages.senderId, `%${q}%`))!);
  if (status) filters.push(eq(smsMessages.status, status));
  if (rangeId) filters.push(eq(smsMessages.rangeId, Number(rangeId)));
  if (from) filters.push(gte(smsMessages.createdAt, from));
  if (to) filters.push(lte(smsMessages.createdAt, to));
  const where = filters.length ? and(...filters) : undefined;

  /* CSV export path */
  if (url.searchParams.get("format") === "csv") {
    const rows = await db
      .select(fields)
      .from(smsMessages)
      .leftJoin(smsRanges, eq(smsMessages.rangeId, smsRanges.id))
      .leftJoin(clients, eq(smsMessages.clientId, clients.id))
      .where(where)
      .orderBy(desc(smsMessages.id))
      .limit(5000);
    const stamp = new Date().toISOString().slice(0, 10);
    const admin = visibility.kind === "admin";
    return csvResponse(
      `ghost-sms-report-${stamp}.csv`,
      admin
        ? ["Timestamp", "MSISDN", "Sender ID", "Message", "Code", "Status", "Rate", "Payout", "Currency", "Supplier", "Range", "Client", "Latency (ms)"]
        : ["Timestamp", "MSISDN", "Sender ID", "Message", "Code", "Status", "Currency", "Range", "Latency (ms)"],
      rows.map((r) => {
        const base = [
          r.createdAt.toISOString(),
          r.msisdn,
          r.senderId,
          r.body,
          r.otpCode,
          r.status,
        ];
        const tail = admin
          ? [r.rate, r.payout, r.currency, r.supplier, r.rangeName, r.clientName, r.latencyMs]
          : [r.currency, r.rangeName, r.latencyMs];
        return [...base, ...tail];
      })
    );
  }

  const { limit, offset, page } = pagination(url);
  const [rows, totalRows, summary] = await Promise.all([
    db
      .select(fields)
      .from(smsMessages)
      .leftJoin(smsRanges, eq(smsMessages.rangeId, smsRanges.id))
      .leftJoin(clients, eq(smsMessages.clientId, clients.id))
      .where(where)
      .orderBy(desc(smsMessages.id))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(smsMessages).where(where),
    db
      .select({ status: smsMessages.status, value: count() })
      .from(smsMessages)
      .where(where)
      .groupBy(smsMessages.status),
  ]);

  return ok({
    total: totalRows[0]?.value ?? 0,
    page,
    summary: Object.fromEntries(summary.map((s) => [s.status, s.value])),
    rows: rows.map((r) => ({ ...r, createdAt: r.createdAt?.toISOString() })),
  });
}
