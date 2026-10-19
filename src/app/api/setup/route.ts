import { count } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, generateApiKey, hashPassword, toSafeUser } from "@/lib/auth";
import { fail, isDatabaseConnectionError, ok, str } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Reports whether the instance still needs its first administrator. */
export async function GET() {
  try {
    const [{ value }] = await db.select({ value: count() }).from(users);
    return ok({ needsSetup: value === 0 });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return fail("Database is offline. Start PostgreSQL on 127.0.0.1:5432 to finish setup.", 503);
    }
    return fail("Setup status check failed.", 500);
  }
}

/**
 * First-run bootstrap: creates the initial administrator account.
 * Disabled automatically once any user exists.
 */
export async function POST(req: Request) {
  try {
    const [{ value }] = await db.select({ value: count() }).from(users);
    if (value > 0) return fail("Setup is disabled: an account already exists.", 403);

    const body = await req.json().catch(() => ({}));
    const username = str(body.username).toLowerCase() || "admin";
    const password = str(body.password) || "Ghost#2026";
    const fullName = str(body.fullName) || "Administrator";

    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) return fail("Username must be 3-32 chars (a-z, 0-9, _ . -).");
    if (password.length < 8) return fail("Password must be at least 8 characters.");

    const [user] = await db
      .insert(users)
      .values({ username, passwordHash: hashPassword(password), fullName, role: "admin", apiKey: generateApiKey() })
      .returning();

    await createSession(user.id);
    return ok({ user: toSafeUser(user), seededPassword: body.password ? undefined : "Ghost#2026" });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return fail("Database is offline. Start PostgreSQL on 127.0.0.1:5432 to finish setup.", 503);
    }
    return fail("Setup failed. Please check the server log and retry.", 500);
  }
}
