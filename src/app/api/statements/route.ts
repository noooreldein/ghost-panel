import { and, count, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { ledgerEntries } from "@/db/schema";
import { csvResponse, fail, isCurrency, ok, pagination, parseDateBoundary, requireAuth, str } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Multi-currency ledger statements (USD / EUR / EGP). */
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const currency = str(url.searchParams.get("currency")).toUpperCase() || "USD";
  if (!isCurrency(currency)) return fail("Currency must be USD, EUR or EGP.");
  const direction = str(url.searchParams.get("direction"));
  const from = parseDateBoundary(url.searchParams.get("from"));
  const to = parseDateBoundary(url.searchParams.get("to"), true);

  const filters: SQL[] = [eq(ledgerEntries.userId, auth.user!.id), eq(ledgerEntries.currency, currency)];
  if (direction === "credit" || direction === "debit") filters.push(eq(ledgerEntries.direction, direction));
  if (from) filters.push(gte(ledgerEntries.createdAt, from));
  if (to) filters.push(lte(ledgerEntries.createdAt, to));
  const where = and(...filters);

  if (url.searchParams.get("format") === "csv") {
    const rows = await db.select().from(ledgerEntries).where(where).orderBy(desc(ledgerEntries.id)).limit(5000);
    return csvResponse(
      `ghost-statement-${currency.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Timestamp", "Description", "Reference", "Direction", "Amount", "Currency"],
      rows.map((r) => [r.createdAt.toISOString(), r.description, r.reference, r.direction, r.amount, r.currency])
    );
  }

  const { limit, offset, page } = pagination(url);
  const [rows, totalRows, sums] = await Promise.all([
    db.select().from(ledgerEntries).where(where).orderBy(desc(ledgerEntries.id)).limit(limit).offset(offset),
    db.select({ value: count() }).from(ledgerEntries).where(where),
    db
      .select({
        credit: sql<string>`coalesce(sum(case when ${ledgerEntries.direction} = 'credit' then ${ledgerEntries.amount} end), 0)`,
        debit: sql<string>`coalesce(sum(case when ${ledgerEntries.direction} = 'debit' then ${ledgerEntries.amount} end), 0)`,
      })
      .from(ledgerEntries)
      .where(where),
  ]);

  const balanceCol =
    currency === "EUR" ? auth.user!.balanceEur : currency === "EGP" ? auth.user!.balanceEgp : auth.user!.balanceUsd;

  return ok({
    currency,
    balance: balanceCol,
    totals: sums[0],
    total: totalRows[0]?.value ?? 0,
    page,
    rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  });
}
