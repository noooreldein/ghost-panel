import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { generateApiKey, hashPassword, toSafeUser } from "@/lib/auth";
import { ROLES } from "@/lib/roles";
import { fail, ok, requireAuth, str } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Admin: update an account — status, role, profile, password reset. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;

  const { id } = await params;
  const targetId = Number(id);
  if (!Number.isInteger(targetId)) return fail("Invalid user id.");

  const body = await req.json().catch(() => ({}));
  const patch: Partial<typeof users.$inferInsert> = {};
  const isSelf = targetId === auth.user!.id;

  if (body.status !== undefined) {
    const status = str(body.status);
    if (!["active", "suspended"].includes(status)) return fail("Invalid status value.");
    if (isSelf && status === "suspended") return fail("You cannot suspend your own account.");
    patch.status = status;
  }

  if (body.role !== undefined) {
    const role = str(body.role);
    if (!ROLES.includes(role as (typeof ROLES)[number])) return fail("Role must be admin, user or supplier.");
    if (isSelf && role !== auth.user!.role) return fail("You cannot change your own role.");
    patch.role = role;
    // suppliers need a live key for the ingest gateway
    if (role === "supplier") patch.apiKey = auth.user!.apiKey ? undefined : generateApiKey();
  }

  if (body.newPassword !== undefined) {
    const newPassword = str(body.newPassword);
    if (newPassword.length < 8) return fail("Password must be at least 8 characters.");
    patch.passwordHash = hashPassword(newPassword);
  }

  if (body.fullName !== undefined) patch.fullName = str(body.fullName) || null;
  if (body.email !== undefined) {
    const email = str(body.email);
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Invalid email address.");
    patch.email = email || null;
  }

  if (!Object.keys(patch).length) return fail("Nothing to update.");

  const [user] = await db.update(users).set(patch).where(eq(users.id, targetId)).returning();
  if (!user) return fail("User not found.", 404);
  return ok({ user: toSafeUser(user) });
}
