import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, generateApiKey, hashPassword, toSafeUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { verifyCaptcha } from "@/lib/captcha";
import { fail, isDatabaseConnectionError, ok, str } from "@/lib/http";
import { USERNAME_RE } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * Public self-service signup. Creates a standard "user" role account and
 * signs it in immediately. The same one-time captcha gate as sign-in keeps
 * bots out; admins keep the admin/users route for privileged roles.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const username = str(body.username).toLowerCase();
  const password = str(body.password);
  const email = str(body.email);
  const captchaId = str(body.captchaId);
  const captchaAnswer = str(body.captchaAnswer);

  if (!USERNAME_RE.test(username)) return fail("Username must be 3-32 characters (a-z, 0-9, _ . -).");
  if (password.length < 8) return fail("Password must be at least 8 characters.");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Invalid email address.");
  if (!captchaId || !captchaAnswer) return fail("Please solve the security captcha.", 400, { code: "captcha" });

  const captchaOk = await verifyCaptcha(captchaId, captchaAnswer);
  if (!captchaOk) return fail("Captcha verification failed. Please try the new challenge.", 400, { code: "captcha" });

  try {
    const existing = await db.select({ id: users.id }).from(users).where(sql`${users.username} = ${username}`).limit(1);
    if (existing[0]) return fail("This username is already taken.", 409);

    const [user] = await db
      .insert(users)
      .values({
        username,
        passwordHash: hashPassword(password),
        email: email || null,
        role: "user",
        apiKey: generateApiKey(),
      })
      .returning();

    await createSession(user.id);
    await audit(user.id, "auth.registered", "user", user.id, { username: user.username, role: user.role, selfService: true });

    return ok({ user: toSafeUser(user) }, 201);
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return fail("Database is offline. Please retry in a moment.", 503);
    }
    return fail("Registration failed. Please retry.", 500);
  }
}
