import { and, count, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { smsNumbers, smsRanges } from "@/db/schema";
import { csvResponse, ok, pagination, requireAuth, str } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const userId = auth.user!.id;

  const url = new URL(req.url);
  const q = str(url.searchParams.get("q"));
  const status = str(url.searchParams.get("status"));
  const rangeId = str(url.searchParams.get("rangeId"));

  const filters: SQL[] = [eq(smsNumbers.assignedUserId, userId)];
  if (q) filters.push(ilike(smsNumbers.msisdn, `%${q}%`));
  if (status) filters.push(eq(smsNumbers.status, status));
  if (rangeId) filters.push(eq(smsNumbers.rangeId, Number(rangeId)));

  const where = and(...filters);

  if (url.searchParams.get("format") === "csv") {
    const rows = await db
      .select({
        msisdn: smsNumbers.msisdn,
        rangeName: smsRanges.name,
        rangePrefix: smsRanges.prefix,
        country: smsRanges.country,
        status: smsNumbers.status,
        source: smsNumbers.source,
        assignedAt: smsNumbers.assignedAt,
        lastMessageAt: smsNumbers.lastMessageAt,
      })
      .from(smsNumbers)
      .leftJoin(smsRanges, eq(smsNumbers.rangeId, smsRanges.id))
      .where(where)
      .orderBy(desc(smsNumbers.id))
      .limit(10000);

    const stamp = new Date().toISOString().slice(0, 10);
    return csvResponse(
      `my-assigned-numbers-${stamp}.csv`,
      ["MSISDN", "Range", "Country", "Status", "Source", "Assigned At", "Last Message At"],
      rows.map((r) => [
        r.msisdn,
        r.rangeName ? `${r.rangeName} (+${r.rangePrefix ?? ""})` : r.rangePrefix ? `+${r.rangePrefix}` : "",
        r.country ?? "",
        r.status,
        r.source ?? "",
        r.assignedAt ? r.assignedAt.toISOString() : "",
        r.lastMessageAt ? r.lastMessageAt.toISOString() : "",
      ])
    );
  }

  const { limit, offset, page } = pagination(url);
  const msgCount = sql<number>`(select count(*)::int from sms_messages m where m.number_id = ${smsNumbers.id})`;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: smsNumbers.id,
        msisdn: smsNumbers.msisdn,
        status: smsNumbers.status,
        source: smsNumbers.source,
        notes: smsNumbers.notes,
        lastMessageAt: smsNumbers.lastMessageAt,
        assignedAt: smsNumbers.assignedAt,
        rangeName: smsRanges.name,
        rangePrefix: smsRanges.prefix,
        country: smsRanges.country,
        messagesCount: msgCount,
      })
      .from(smsNumbers)
      .leftJoin(smsRanges, eq(smsNumbers.rangeId, smsRanges.id))
      .where(where)
      .orderBy(desc(smsNumbers.id))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(smsNumbers).where(where),
  ]);

  return ok({
    total: totalRows[0]?.value ?? 0,
    page,
    rows: rows.map((r) => ({
      ...r,
      assignedAt: r.assignedAt ? r.assignedAt.toISOString() : null,
      lastMessageAt: r.lastMessageAt ? r.lastMessageAt.toISOString() : null,
    })),
  });
}
