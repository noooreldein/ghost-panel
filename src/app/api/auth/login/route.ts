import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, toSafeUser, verifyPassword } from "@/lib/auth";
import { verifyCaptcha } from "@/lib/captcha";
import { fail, isDatabaseConnectionError, ok, str } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const username = str(body.username).toLowerCase();
  const password = str(body.password);
  const captchaId = str(body.captchaId);
  const captchaAnswer = str(body.captchaAnswer);

  if (!username || !password) return fail("Username and password are required.");
  if (!captchaId || !captchaAnswer) return fail("Please solve the security captcha.", 400, { code: "captcha" });

  const captchaOk = await verifyCaptcha(captchaId, captchaAnswer);
  if (!captchaOk) return fail("Captcha verification failed. Please try the new challenge.", 400, { code: "captcha" });

  try {
    const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
    const user = rows[0];
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return fail("Invalid username or password.", 401);
    }
    if (user.status !== "active") return fail("This account is suspended. Contact your administrator.", 403);

    await createSession(user.id);
    return ok({ user: toSafeUser(user) });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return fail("Database is offline. Start PostgreSQL on 127.0.0.1:5432, then try signing in again.", 503);
    }
    return fail("Sign-in failed. Please check the server log and retry.", 500);
  }
}
