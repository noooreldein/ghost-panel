import { eq } from "drizzle-orm";
import { db } from "@/db";
import { smsRanges } from "@/db/schema";
import { fail, isCurrency, ok, requireAuth, str, strAmount } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const rangeId = Number(id);
  if (!Number.isInteger(rangeId)) return fail("Invalid range id.");

  const body = await req.json().catch(() => ({}));
  const patch: Partial<typeof smsRanges.$inferInsert> = {};

  if (body.status !== undefined) {
    const status = str(body.status);
    if (!["active", "paused"].includes(status)) return fail("Invalid status value.");
    patch.status = status;
  }
  if (body.name !== undefined) {
    const name = str(body.name);
    if (!name) return fail("Name cannot be empty.");
    patch.name = name;
  }
  if (body.rate !== undefined) {
    const rate = strAmount(body.rate);
    if (rate === null) return fail("Invalid rate.");
    patch.rate = rate;
  }
  if (body.payout !== undefined) {
    const payout = strAmount(body.payout);
    if (payout === null) return fail("Invalid payout.");
    patch.payout = payout;
  }
  if (body.currency !== undefined) {
    const currency = str(body.currency).toUpperCase();
    if (!isCurrency(currency)) return fail("Invalid currency.");
    patch.currency = currency;
  }
  if (body.network !== undefined) patch.network = str(body.network) || null;
  if (body.supplier !== undefined) patch.supplier = str(body.supplier) || null;

  if (!Object.keys(patch).length) return fail("Nothing to update.");

  const [row] = await db.update(smsRanges).set(patch).where(eq(smsRanges.id, rangeId)).returning();
  if (!row) return fail("Range not found.", 404);
  return ok({ row });
}
