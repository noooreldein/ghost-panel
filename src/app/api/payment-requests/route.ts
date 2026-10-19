import { and, count, desc, eq, gte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { ledgerEntries, paymentRequests, payoutAccounts, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { decryptSecret } from "@/lib/provider-secrets";
import { fail, isCurrency, ok, pagination, requireAuth, str } from "@/lib/http";

export const dynamic = "force-dynamic";

const METHODS = ["bank", "paypal", "crypto"];

function balanceColumn(currency: string) {
  return currency === "EUR" ? users.balanceEur : currency === "EGP" ? users.balanceEgp : users.balanceUsd;
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const status = str(url.searchParams.get("status"));
  const { limit, offset, page } = pagination(url);

  const filters: SQL[] = [];
  if (auth.user!.role !== "admin") filters.push(eq(paymentRequests.userId, auth.user!.id));
  if (status) filters.push(eq(paymentRequests.status, status));
  const where = filters.length ? and(...filters) : undefined;

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: paymentRequests.id,
        userId: paymentRequests.userId,
        username: users.username,
        amount: paymentRequests.amount,
        currency: paymentRequests.currency,
        method: paymentRequests.method,
        destination: paymentRequests.destination,
        status: paymentRequests.status,
        note: paymentRequests.note,
        createdAt: paymentRequests.createdAt,
        processedAt: paymentRequests.processedAt,
      })
      .from(paymentRequests)
      .innerJoin(users, eq(users.id, paymentRequests.userId))
      .where(where)
      .orderBy(desc(paymentRequests.id))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(paymentRequests).where(where),
  ]);

  return ok({
    total: totalRows[0]?.value ?? 0,
    page,
    rows: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      processedAt: r.processedAt ? r.processedAt.toISOString() : null,
    })),
  });
}

class InsufficientFunds extends Error {}

/**
 * Creates a withdrawal request. Funds are locked immediately (debited) and
 * refunded automatically if an admin rejects the request.
 */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const amount = str(body.amount);
  const currency = str(body.currency).toUpperCase() || "USD";
  const method = str(body.method).toLowerCase() || "bank";
  const payoutAccountId = body.payoutAccountId ? Number(body.payoutAccountId) : null;
  let destination = str(body.destination);
  const note = str(body.note);

  if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) return fail("Enter a valid amount.");
  if (!isCurrency(currency)) return fail("Currency must be USD, EUR or EGP.");
  if (!METHODS.includes(method)) return fail("Unsupported payout method.");
  if (payoutAccountId) {
    if (!Number.isInteger(payoutAccountId) || payoutAccountId < 1) return fail("حساب السحب غير صالح.");
    const [account] = await db.select().from(payoutAccounts).where(and(eq(payoutAccounts.id, payoutAccountId), eq(payoutAccounts.userId, auth.user!.id), eq(payoutAccounts.status, "active"))).limit(1);
    if (!account) return fail("حساب السحب غير موجود أو مؤرشف.", 404);
    try { destination = decryptSecret(account.destinationCiphertext); }
    catch { return fail("تعذر قراءة بيانات حساب السحب. تحقق من PROVIDER_ENCRYPTION_KEY.", 503); }
  }
  if (destination.length < 4) return fail("Payout destination is required (IBAN / wallet / email).");

  const col = balanceColumn(currency);
  const colKey = currency === "EUR" ? "balanceEur" : currency === "EGP" ? "balanceEgp" : "balanceUsd";
  const user = auth.user!;

  try {
    const request = await db.transaction(async (tx) => {
      // atomic balance guard: only debits if funds are sufficient
      const debited = await tx
        .update(users)
        .set({ [colKey]: sql`${col} - ${amount}::numeric` })
        .where(and(eq(users.id, user.id), gte(col, amount)))
        .returning({ id: users.id });
      if (!debited[0]) throw new InsufficientFunds();

      const [request] = await tx
        .insert(paymentRequests)
        .values({ userId: user.id, amount, currency, method, destination, note: note || null })
        .returning();

      await tx.insert(ledgerEntries).values({
        userId: user.id,
        currency,
        direction: "debit",
        amount,
        description: `Withdrawal request via ${method}`,
        reference: `PR-${request.id}`,
      });
      return request;
    });

    await audit(user.id, "payment_request.created", "payment_request", request.id, { amount, currency, method, payoutAccountId });
    return ok({ row: { ...request, createdAt: request.createdAt.toISOString() } }, 201);
  } catch (err) {
    if (err instanceof InsufficientFunds) return fail("Insufficient balance for this withdrawal.", 400, { code: "funds" });
    throw err;
  }
}
