import { and, count, desc, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { generateApiKey, hashPassword, toSafeUser } from "@/lib/auth";
import { ROLES, USERNAME_RE } from "@/lib/roles";
import { fail, ok, pagination, requireAuth, str } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Admin: list operator accounts. */
export async function GET(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const q = str(url.searchParams.get("q"));
  const { limit, offset, page } = pagination(url);

  const filters: SQL[] = [];
  if (q) filters.push(or(ilike(users.username, `%${q}%`), ilike(users.fullName, `%${q}%`))!);
  const where = filters.length ? and(...filters) : undefined;

  const [rows, totalRows] = await Promise.all([
    db.select().from(users).where(where).orderBy(desc(users.id)).limit(limit).offset(offset),
    db.select({ value: count() }).from(users).where(where),
  ]);

  // hashes never leave the server (toSafeUser excludes them)
  return ok({
    total: totalRows[0]?.value ?? 0,
    page,
    rows: rows.map((u) => toSafeUser(u)),
    me: auth.user!.id,
  });
}

/** Admin: create an operator account (owner capability). */
export async function POST(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const username = str(body.username).toLowerCase();
  const password = str(body.password);
  const fullName = str(body.fullName);
  const email = str(body.email);
  const role = str(body.role) || "user";

  if (!USERNAME_RE.test(username)) return fail("Username must be 3-32 chars (a-z, 0-9, _ . -).");
  if (password.length < 8) return fail("Password must be at least 8 characters.");
  if (!ROLES.includes(role as (typeof ROLES)[number])) return fail("Role must be admin, user or supplier.");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Invalid email address.");

  const existing = await db.select({ id: users.id }).from(users).where(sql`${users.username} = ${username}`).limit(1);
  if (existing[0]) return fail("This username is already taken.", 409);

  const [user] = await db
    .insert(users)
    .values({
      username,
      passwordHash: hashPassword(password),
      fullName: fullName || null,
      email: email || null,
      role,
      apiKey: generateApiKey(),
    })
    .returning();

  await audit(auth.user!.id, "user.created", "user", user.id, { username: user.username, role: user.role });

  return ok({ user: toSafeUser(user) }, 201);
}
