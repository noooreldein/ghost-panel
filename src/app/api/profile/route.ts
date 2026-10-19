import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { hashPassword, toSafeUser, verifyPassword } from "@/lib/auth";
import { fail, ok, requireAuth, str } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (auth.error || !auth.user) return auth.error ?? fail("Unauthorized", 401);
  const user = auth.user;

  const body = await req.json().catch(() => ({}));
  const fullNameStr = body.fullName !== undefined ? str(body.fullName) : undefined;
  const emailStr = body.email !== undefined ? str(body.email) : undefined;
  const currentPasswordStr = str(body.currentPassword);
  const newPasswordStr = str(body.newPassword);

  if (newPasswordStr) {
    if (!currentPasswordStr) {
      return fail("كلمة المرور الحالية غير صحيحة.", 400);
    }
    const verified = verifyPassword(currentPasswordStr, user.passwordHash);
    if (!verified) {
      return fail("كلمة المرور الحالية غير صحيحة.", 400);
    }
    if (newPasswordStr.length < 8) {
      return fail("Password must be at least 8 characters long.", 400);
    }
  }

  if (emailStr && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
    return fail("Invalid email address format.", 400);
  }

  const updateData: Record<string, unknown> = {};
  if (fullNameStr !== undefined) {
    updateData.fullName = fullNameStr || null;
  }
  if (emailStr !== undefined) {
    updateData.email = emailStr || null;
  }
  if (newPasswordStr) {
    updateData.passwordHash = hashPassword(newPasswordStr);
  }

  if (Object.keys(updateData).length === 0) {
    return ok({ user: toSafeUser(user) });
  }

  const [updated] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, user.id))
    .returning();

  if (!updated) {
    return fail("User update failed.", 500);
  }

  if (newPasswordStr) {
    await audit(user.id, "profile.password_changed", "users", String(user.id));
  } else {
    await audit(user.id, "profile.updated", "users", String(user.id));
  }

  return ok({ user: toSafeUser(updated) });
}
