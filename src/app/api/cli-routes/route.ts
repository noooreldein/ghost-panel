import { count, desc, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { cliRoutes } from "@/db/schema";
import { fail, isCurrency, ok, pagination, requireAuth, str, strAmount } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * CLI Search.
 *  ?number=447700900123 → longest-prefix production route lookup (Test Lookup)
 *  ?q=44                → browse route inventory
 * Standard users may only run test lookups; provisioning real routes is an
 * admin/support action.
 */
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const number = str(url.searchParams.get("number")).replace(/^\+/, "").replace(/[\s-]/g, "");
  const q = str(url.searchParams.get("q"));

  if (number) {
    if (!/^[0-9]{5,15}$/.test(number)) return fail("Enter a valid dialed number (5-15 digits).");
    const rows = await db
      .select()
      .from(cliRoutes)
      .where(sql`${number} like ${cliRoutes.prefix} || '%'`)
      .orderBy(sql`length(${cliRoutes.prefix}) desc`)
      .limit(1);

    return ok({
      mode: "lookup",
      query: number,
      match: rows[0] ?? null,
      restriction: "TEST_LOOKUP_ONLY",
      note: "Test lookup result. Production route provisioning requires an administrator / support ticket.",
    });
  }

  const { limit, offset, page } = pagination(url, 25);
  const where = q
    ? or(ilike(cliRoutes.prefix, `%${q}%`), ilike(cliRoutes.country, `%${q}%`), ilike(cliRoutes.network, `%${q}%`))
    : undefined;

  const [rows, totalRows] = await Promise.all([
    db.select().from(cliRoutes).where(where).orderBy(desc(cliRoutes.id)).limit(limit).offset(offset),
    db.select({ value: count() }).from(cliRoutes).where(where),
  ]);

  return ok({
    mode: "browse",
    total: totalRows[0]?.value ?? 0,
    page,
    rows,
    restriction: auth.user!.role === "admin" ? "ADMIN_FULL" : "TEST_LOOKUP_ONLY",
  });
}

/** Admin: provision a production CLI route. */
export async function POST(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const prefix = str(body.prefix).replace(/^\+/, "");
  const country = str(body.country);
  const network = str(body.network);
  const supplier = str(body.supplier);
  const currency = str(body.currency).toUpperCase() || "USD";
  const rate = strAmount(body.rate) ?? "0";

  if (!/^[0-9]{1,12}$/.test(prefix)) return fail("Prefix must be numeric (e.g. 44, 20155).");
  if (!country) return fail("Country is required.");
  if (!isCurrency(currency)) return fail("Currency must be USD, EUR or EGP.");

  const existing = await db.select({ id: cliRoutes.id }).from(cliRoutes).where(sql`${cliRoutes.prefix} = ${prefix}`).limit(1);
  if (existing[0]) return fail("A route for this prefix already exists.", 409);

  const [row] = await db
    .insert(cliRoutes)
    .values({ prefix, country, network: network || null, supplier: supplier || null, currency, rate })
    .returning();
  return ok({ row }, 201);
}
