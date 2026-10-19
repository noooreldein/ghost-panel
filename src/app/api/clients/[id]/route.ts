import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { fail, ok, requireAuth, str, strAmount } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const clientId = Number(id);
  if (!Number.isInteger(clientId)) return fail("Invalid client id.");

  const body = await req.json().catch(() => ({}));
  const patch: Partial<typeof clients.$inferInsert> = {};

  if (body.status !== undefined) {
    const status = str(body.status);
    if (!["active", "suspended"].includes(status)) return fail("Invalid status value.");
    patch.status = status;
  }
  if (body.name !== undefined) {
    const name = str(body.name);
    if (!name) return fail("Name cannot be empty.");
    patch.name = name;
  }
  if (body.marginPct !== undefined) {
    const marginPct = strAmount(body.marginPct);
    if (marginPct === null) return fail("Invalid margin value.");
    patch.marginPct = marginPct;
  }
  if (body.email !== undefined) {
    const email = str(body.email);
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Invalid contact email.");
    patch.email = email || null;
  }
  if (body.company !== undefined) patch.company = str(body.company) || null;
  if (body.notes !== undefined) patch.notes = str(body.notes) || null;
  if (Array.isArray(body.permissions)) {
    patch.permissions = body.permissions.filter((p: unknown) => typeof p === "string");
  }

  if (!Object.keys(patch).length) return fail("Nothing to update.");

  const [row] = await db.update(clients).set(patch).where(eq(clients.id, clientId)).returning();
  if (!row) return fail("Client not found.", 404);
  return ok({ row });
}
