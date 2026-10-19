import { and, count, desc, eq, gte, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { creditNotes, ledgerEntries, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { csvResponse, fail, isCurrency, ok, pagination, parseDateBoundary, requireAuth, str } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const status = str(url.searchParams.get("status"));
  const format = str(url.searchParams.get("format"));
  const filterUserId = url.searchParams.get("userId") ? Number(url.searchParams.get("userId")) : null;

  const isAdmin = auth.user!.role === "admin";

  if (format === "csv") {
    if (!isAdmin) return fail("Forbidden: admin export only.", 403);

    const filters: SQL[] = [];
    if (status) filters.push(eq(creditNotes.status, status));
    if (filterUserId && Number.isInteger(filterUserId) && filterUserId > 0) {
      filters.push(eq(creditNotes.userId, filterUserId));
    }
    const where = filters.length ? and(...filters) : undefined;

    const rows = await db
      .select({
        id: creditNotes.id,
        userId: creditNotes.userId,
        username: users.username,
        periodStart: creditNotes.periodStart,
        periodEnd: creditNotes.periodEnd,
        amount: creditNotes.amount,
        currency: creditNotes.currency,
        status: creditNotes.status,
        remarks: creditNotes.remarks,
        issuedAt: creditNotes.issuedAt,
        dueDate: creditNotes.dueDate,
        paidAt: creditNotes.paidAt,
      })
      .from(creditNotes)
      .innerJoin(users, eq(users.id, creditNotes.userId))
      .where(where)
      .orderBy(desc(creditNotes.id));

    const headers = [
      "ID",
      "Account",
      "Period Start",
      "Period End",
      "Amount",
      "Currency",
      "Status",
      "Remarks",
      "Issued At",
      "Paid At",
    ];

    const csvRows = rows.map((r) => [
      r.id,
      r.username,
      r.periodStart ? r.periodStart.toISOString() : "",
      r.periodEnd ? r.periodEnd.toISOString() : "",
      r.amount,
      r.currency,
      r.status,
      r.remarks ?? "",
      r.issuedAt ? r.issuedAt.toISOString() : "",
      r.paidAt ? r.paidAt.toISOString() : "",
    ]);

    return csvResponse("credit-notes.csv", headers, csvRows);
  }

  const { limit, offset, page } = pagination(url);

  const filters: SQL[] = [];
  if (!isAdmin) {
    filters.push(eq(creditNotes.userId, auth.user!.id));
  } else if (filterUserId && Number.isInteger(filterUserId) && filterUserId > 0) {
    filters.push(eq(creditNotes.userId, filterUserId));
  }

  if (status) filters.push(eq(creditNotes.status, status));
  const where = filters.length ? and(...filters) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: creditNotes.id,
        userId: creditNotes.userId,
        username: users.username,
        periodStart: creditNotes.periodStart,
        periodEnd: creditNotes.periodEnd,
        amount: creditNotes.amount,
        currency: creditNotes.currency,
        status: creditNotes.status,
        remarks: creditNotes.remarks,
        issuedAt: creditNotes.issuedAt,
        dueDate: creditNotes.dueDate,
        paidAt: creditNotes.paidAt,
      })
      .from(creditNotes)
      .innerJoin(users, eq(users.id, creditNotes.userId))
      .where(where)
      .orderBy(desc(creditNotes.id))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(creditNotes).where(where),
  ]);

  return ok({
    total: totalRows[0]?.value ?? 0,
    page,
    rows: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      ...(isAdmin ? { username: r.username } : {}),
      periodStart: r.periodStart.toISOString(),
      periodEnd: r.periodEnd.toISOString(),
      amount: r.amount,
      currency: r.currency,
      status: r.status,
      remarks: r.remarks,
      issuedAt: r.issuedAt.toISOString(),
      dueDate: r.dueDate ? r.dueDate.toISOString() : null,
      paidAt: r.paidAt ? r.paidAt.toISOString() : null,
    })),
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const targetUserId = body.userId ? Number(body.userId) : null;
  const currency = str(body.currency).toUpperCase() || "USD";
  const remarks = str(body.remarks) || null;

  if (!isCurrency(currency)) {
    return fail("Currency must be USD, EUR or EGP.");
  }

  let pEnd: Date;
  let pStart: Date;

  if (body.periodEnd && str(body.periodEnd)) {
    pEnd = parseDateBoundary(str(body.periodEnd), true) ?? new Date();
  } else {
    pEnd = new Date();
  }

  if (body.periodStart && str(body.periodStart)) {
    pStart = parseDateBoundary(str(body.periodStart), false) ?? new Date(pEnd.getTime() - 7 * 86400 * 1000);
  } else {
    pStart = new Date(pEnd.getTime() - 7 * 86400 * 1000);
  }

  if (pStart >= pEnd) {
    return fail("periodStart must be before periodEnd.");
  }

  let targetUsers: { id: number; username: string }[] = [];

  if (targetUserId && Number.isInteger(targetUserId) && targetUserId > 0) {
    const usersList = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(and(eq(users.id, targetUserId), eq(users.status, "active")))
      .limit(1);
    if (!usersList[0]) {
      return fail("Target user not found or inactive.", 404);
    }
    targetUsers = usersList;
  } else {
    targetUsers = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(
        and(
          eq(users.status, "active"),
          or(eq(users.role, "user"), eq(users.role, "supplier"))
        )
      );
  }

  const createdNotes = [];

  for (const targetUser of targetUsers) {
    // Check if an existing note overlaps the same period and currency
    const existing = await db
      .select({ id: creditNotes.id })
      .from(creditNotes)
      .where(
        and(
          eq(creditNotes.userId, targetUser.id),
          eq(creditNotes.currency, currency),
          sql`${creditNotes.periodStart} < ${pEnd}`,
          sql`${creditNotes.periodEnd} > ${pStart}`
        )
      )
      .limit(1);

    if (existing[0]) {
      continue; // Skip duplicate / overlapping note
    }

    // Compute net ledger movement
    const entries = await db
      .select({
        direction: ledgerEntries.direction,
        amount: ledgerEntries.amount,
      })
      .from(ledgerEntries)
      .where(
        and(
          eq(ledgerEntries.userId, targetUser.id),
          eq(ledgerEntries.currency, currency),
          gte(ledgerEntries.createdAt, pStart),
          lte(ledgerEntries.createdAt, pEnd)
        )
      );

    let credits = 0;
    let debits = 0;
    for (const e of entries) {
      const amt = Number(e.amount);
      if (e.direction === "credit") credits += amt;
      else if (e.direction === "debit") debits += amt;
    }

    const net = credits - debits;

    if (net > 0) {
      const amountStr = net.toFixed(2);
      const dueDate = new Date(pEnd.getTime() + 7 * 86400 * 1000);

      const [inserted] = await db
        .insert(creditNotes)
        .values({
          userId: targetUser.id,
          periodStart: pStart,
          periodEnd: pEnd,
          amount: amountStr,
          currency,
          status: "pending",
          remarks,
          dueDate,
        })
        .returning();

      createdNotes.push({
        id: inserted.id,
        userId: inserted.userId,
        username: targetUser.username,
        periodStart: inserted.periodStart.toISOString(),
        periodEnd: inserted.periodEnd.toISOString(),
        amount: inserted.amount,
        currency: inserted.currency,
        status: inserted.status,
        remarks: inserted.remarks,
        issuedAt: inserted.issuedAt.toISOString(),
        dueDate: inserted.dueDate ? inserted.dueDate.toISOString() : null,
        paidAt: null,
      });
    }
  }

  await audit(auth.user!.id, "credit_note.generated", "credit_notes", null, {
    count: createdNotes.length,
    currency,
    periodStart: pStart.toISOString(),
    periodEnd: pEnd.toISOString(),
  });

  return ok({ created: createdNotes.length, rows: createdNotes }, 201);
}

export async function PATCH(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  const status = str(body.status).toLowerCase();

  if (!Number.isInteger(id) || id < 1) return fail("Invalid credit note ID.");
  if (status !== "paid" && status !== "pending") return fail("Status must be 'paid' or 'pending'.");

  const [existing] = await db.select().from(creditNotes).where(eq(creditNotes.id, id)).limit(1);
  if (!existing) return fail("Credit note not found.", 404);

  const paidAt = status === "paid" ? new Date() : null;

  const [updated] = await db
    .update(creditNotes)
    .set({ status, paidAt })
    .where(eq(creditNotes.id, id))
    .returning();

  const auditAction = status === "paid" ? "credit_note.paid" : "credit_note.reopened";
  await audit(auth.user!.id, auditAction, "credit_notes", id, {
    amount: updated.amount,
    currency: updated.currency,
    userId: updated.userId,
    status: updated.status,
  });

  const [userRow] = await db.select({ username: users.username }).from(users).where(eq(users.id, updated.userId)).limit(1);

  return ok({
    row: {
      id: updated.id,
      userId: updated.userId,
      username: userRow?.username ?? "",
      periodStart: updated.periodStart.toISOString(),
      periodEnd: updated.periodEnd.toISOString(),
      amount: updated.amount,
      currency: updated.currency,
      status: updated.status,
      remarks: updated.remarks,
      issuedAt: updated.issuedAt.toISOString(),
      dueDate: updated.dueDate ? updated.dueDate.toISOString() : null,
      paidAt: updated.paidAt ? updated.paidAt.toISOString() : null,
    },
  });
}
