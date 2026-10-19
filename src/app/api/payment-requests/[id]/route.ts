import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { ledgerEntries, paymentRequests, users } from "@/db/schema";
import { fail, ok, requireAuth, str } from "@/lib/http";

export const dynamic = "force-dynamic";

class StaleRequest extends Error {}

/** Admin: approve or reject a pending withdrawal. Rejection refunds the user. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const requestId = Number(id);
  if (!Number.isInteger(requestId)) return fail("Invalid request id.");

  const body = await req.json().catch(() => ({}));
  const action = str(body.action);
  if (!["approve", "reject"].includes(action)) return fail("Action must be approve or reject.");

  try {
    const updated = await db.transaction(async (tx) => {
      // state guard: only a pending request can transition
      const [request] = await tx
        .update(paymentRequests)
        .set({
          status: action === "approve" ? "approved" : "rejected",
          processedAt: new Date(),
          note: str(body.note) || undefined,
        })
        .where(and(eq(paymentRequests.id, requestId), eq(paymentRequests.status, "pending")))
        .returning();
      if (!request) throw new StaleRequest();

      if (action === "reject") {
        const col =
          request.currency === "EUR" ? users.balanceEur : request.currency === "EGP" ? users.balanceEgp : users.balanceUsd;
        const colKey =
          request.currency === "EUR" ? "balanceEur" : request.currency === "EGP" ? "balanceEgp" : "balanceUsd";
        await tx
          .update(users)
          .set({ [colKey]: sql`${col} + ${request.amount}::numeric` })
          .where(eq(users.id, request.userId));
        await tx.insert(ledgerEntries).values({
          userId: request.userId,
          currency: request.currency,
          direction: "credit",
          amount: request.amount,
          description: `Withdrawal ${request.id} rejected — funds returned`,
          reference: `PR-${request.id}-REFUND`,
        });
      }
      return request;
    });

    return ok({ row: updated });
  } catch (err) {
    if (err instanceof StaleRequest) return fail("This request is no longer pending.", 409);
    throw err;
  }
}
