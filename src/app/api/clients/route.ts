import { and, count, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { audit } from "@/lib/audit";
import { fail, ok, pagination, requireAuth, str, strAmount } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const q = str(url.searchParams.get("q"));
  const status = str(url.searchParams.get("status"));
  const { limit, offset, page } = pagination(url);

  const filters: SQL[] = [];
  if (q) filters.push(ilike(clients.name, `%${q}%`));
  if (status) filters.push(eq(clients.status, status));
  const where = filters.length ? and(...filters) : undefined;

  const msgCount = sql<number>`(select count(*)::int from sms_messages m where m.client_id = ${clients.id})`;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: clients.id,
        name: clients.name,
        email: clients.email,
        company: clients.company,
        status: clients.status,
        marginPct: clients.marginPct,
        permissions: clients.permissions,
        notes: clients.notes,
        createdAt: clients.createdAt,
        messagesCount: msgCount,
      })
      .from(clients)
      .where(where)
      .orderBy(desc(clients.id))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(clients).where(where),
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
  const email = str(body.email);
  const company = str(body.company);
  const marginPct = strAmount(body.marginPct) ?? "0";
  const notes = str(body.notes);

  if (!name) return fail("Client name is required.");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Invalid contact email.");

  const permissions: string[] = Array.isArray(body.permissions)
    ? body.permissions.filter((p: unknown) => typeof p === "string")
    : [];

  const [row] = await db
    .insert(clients)
    .values({ name, email: email || null, company: company || null, marginPct, notes: notes || null, permissions })
    .returning();
  await audit(auth.user!.id, "client.created", "client", row.id, { name: row.name, company: row.company, status: row.status });
  return ok({ row }, 201);
}
