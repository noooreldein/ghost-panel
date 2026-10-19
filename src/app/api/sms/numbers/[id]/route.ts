import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, smsNumbers } from "@/db/schema";
import { audit } from "@/lib/audit";
import { fail, ok, requireAuth, str } from "@/lib/http";

export const dynamic = "force-dynamic";

const ALLOWED_STATUS = ["active", "paused", "blocked"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) return fail("Invalid number id.");

  const body = await req.json().catch(() => ({}));
  const patch: Partial<typeof smsNumbers.$inferInsert> = {};
  const status = str(body.status);
  if (status) {
    if (!ALLOWED_STATUS.includes(status)) return fail("Invalid status value.");
    patch.status = status;
  }
  if (body.notes !== undefined) patch.notes = str(body.notes);
  if (body.assignedClientId !== undefined) {
    const clientId = body.assignedClientId === null || body.assignedClientId === "" ? null : Number(body.assignedClientId);
    if (clientId !== null && (!Number.isInteger(clientId) || clientId < 1)) return fail("Invalid client id.");
    if (clientId) {
      const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId)).limit(1);
      if (!client) return fail("Client not found.", 404);
    }
    patch.assignedClientId = clientId;
  }
  if (!Object.keys(patch).length) return fail("Nothing to update.");

  const [row] = await db.update(smsNumbers).set(patch).where(eq(smsNumbers.id, numId)).returning();
  if (!row) return fail("Number not found.", 404);
  await audit(auth.user!.id, "number.updated", "sms_number", row.id, { status: row.status, assignedClientId: row.assignedClientId });
  return ok({ row });
}
