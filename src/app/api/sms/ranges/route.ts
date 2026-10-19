import { and, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { smsRanges } from "@/db/schema";
import { audit } from "@/lib/audit";
import { fail, isCurrency, ok, pagination, requireAuth, str, strAmount } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const q = str(url.searchParams.get("q"));
  const status = str(url.searchParams.get("status"));
  const { limit, offset, page } = pagination(url);

  const filters: SQL[] = [];
  if (q) filters.push(or(ilike(smsRanges.name, `%${q}%`), ilike(smsRanges.prefix, `%${q}%`), ilike(smsRanges.country, `%${q}%`))!);
  if (status) filters.push(eq(smsRanges.status, status));
  const where = filters.length ? and(...filters) : undefined;

  const numbersCount = sql<number>`(select count(*)::int from sms_numbers n where n.range_id = ${smsRanges.id})`;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: smsRanges.id,
        name: smsRanges.name,
        prefix: smsRanges.prefix,
        country: smsRanges.country,
        network: smsRanges.network,
        currency: smsRanges.currency,
        rate: smsRanges.rate,
        payout: smsRanges.payout,
        supplier: smsRanges.supplier,
        status: smsRanges.status,
        createdAt: smsRanges.createdAt,
        numbersCount,
      })
      .from(smsRanges)
      .where(where)
      .orderBy(desc(smsRanges.id))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(smsRanges).where(where),
  ]);

  return ok({
    total: totalRows[0]?.value ?? 0,
    page,
    rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const name = str(body.name);
  const prefix = str(body.prefix).replace(/^\+/, "");
  const country = str(body.country);
  const network = str(body.network);
  const supplier = str(body.supplier);
  const currency = str(body.currency).toUpperCase() || "USD";
  const rate = strAmount(body.rate) ?? "0";
  const payout = strAmount(body.payout) ?? "0";

  if (!name) return fail("Range name is required.");
  if (!/^[0-9]{1,12}$/.test(prefix)) return fail("Prefix must be numeric (e.g. 4477, 20155).");
  if (!country) return fail("Country is required.");
  if (!isCurrency(currency)) return fail("Currency must be USD, EUR or EGP.");

  const [row] = await db
    .insert(smsRanges)
    .values({ name, prefix, country, network: network || null, supplier: supplier || null, currency, rate, payout })
    .returning();
  await audit(auth.user!.id, "range.created", "sms_range", row.id, { name: row.name, prefix: row.prefix, country: row.country, supplier: row.supplier });
  return ok({ row }, 201);
}
