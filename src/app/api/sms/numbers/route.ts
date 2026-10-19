import { and, count, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { clients, smsNumbers, smsRanges } from "@/db/schema";
import { audit } from "@/lib/audit";
import { fail, ok, pagination, requireAuth, str } from "@/lib/http";
import { normalizeMsisdn } from "@/lib/sms";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const q = str(url.searchParams.get("q"));
  const status = str(url.searchParams.get("status"));
  const rangeId = str(url.searchParams.get("rangeId"));
  const clientId = str(url.searchParams.get("clientId"));
  const { limit, offset, page } = pagination(url);

  const filters: SQL[] = [];
  if (q) filters.push(ilike(smsNumbers.msisdn, `%${q}%`));
  if (status) filters.push(eq(smsNumbers.status, status));
  if (rangeId) filters.push(eq(smsNumbers.rangeId, Number(rangeId)));
  if (clientId === "unassigned") filters.push(sql`${smsNumbers.assignedClientId} is null`);
  else if (clientId) filters.push(eq(smsNumbers.assignedClientId, Number(clientId)));

  const where = filters.length ? and(...filters) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: smsNumbers.id,
        msisdn: smsNumbers.msisdn,
        status: smsNumbers.status,
        source: smsNumbers.source,
        notes: smsNumbers.notes,
        lastMessageAt: smsNumbers.lastMessageAt,
        createdAt: smsNumbers.createdAt,
        rangeId: smsNumbers.rangeId,
        assignedClientId: smsNumbers.assignedClientId,
        assignedClientName: clients.name,
        rangeName: smsRanges.name,
        rangePrefix: smsRanges.prefix,
        country: smsRanges.country,
      })
      .from(smsNumbers)
      .leftJoin(smsRanges, eq(smsNumbers.rangeId, smsRanges.id))
      .leftJoin(clients, eq(smsNumbers.assignedClientId, clients.id))
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
      createdAt: r.createdAt.toISOString(),
      lastMessageAt: r.lastMessageAt ? r.lastMessageAt.toISOString() : null,
    })),
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const msisdn = normalizeMsisdn(str(body.msisdn));
  const rangeId = body.rangeId ? Number(body.rangeId) : null;
  const source = str(body.source) || "manual";
  const notes = str(body.notes);

  if (!/^\+?[0-9]{7,15}$/.test(msisdn)) return fail("MSISDN must be a valid E.164-style number (7-15 digits).");

  if (rangeId) {
    const range = await db.select({ id: smsRanges.id }).from(smsRanges).where(eq(smsRanges.id, rangeId)).limit(1);
    if (!range[0]) return fail("Selected range does not exist.", 404);
  }

  const existing = await db.select({ id: smsNumbers.id }).from(smsNumbers).where(eq(smsNumbers.msisdn, msisdn)).limit(1);
  if (existing[0]) return fail("This number already exists in the inventory.", 409);

  const [row] = await db.insert(smsNumbers).values({ msisdn, rangeId, source, notes }).returning();
  await audit(auth.user!.id, "number.provisioned", "sms_number", row.id, { msisdn: row.msisdn, rangeId: row.rangeId, source: row.source });
  return ok({ row }, 201);
}
