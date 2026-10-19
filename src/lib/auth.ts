import { cookies } from "next/headers";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";

export const SESSION_COOKIE = "ghost_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const target = Buffer.from(hash, "hex");
  return candidate.length === target.length && timingSafeEqual(candidate, target);
}

export function generateApiKey(): string {
  return `gk_live_${randomBytes(20).toString("hex")}`;
}

/* ------------------------------------------------------------------ */

export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ tokenHash: sha256(token), userId, expiresAt });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token))).catch(() => {});
  }
  store.delete(SESSION_COOKIE);
}

// In-memory session cache (development only) to avoid transient database retries during SSR.
// Keys are raw tokens (not hashed).
const globalForSessions = globalThis as typeof globalThis & {
  __ghostSessionCache?: Map<string, { user: any; expiresAt: number }>;
};

const sessionCache =
  globalForSessions.__ghostSessionCache ?? (globalForSessions.__ghostSessionCache = new Map());

function cleanupSessionCache(): void {
  const now = Date.now();
  for (const [k, v] of sessionCache) if (v.expiresAt <= now) sessionCache.delete(k);
}

export async function getSessionUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  // Check in-memory cache first (dev-only). This avoids hitting the DB during
  // sporadic runtime/disk-driver failures.
  if (process.env.NODE_ENV !== "production") {
    cleanupSessionCache();
    const cached = sessionCache.get(token);
    if (cached) {
      return cached.user as User;
    }
  }
  // Some runtimes (Turbopack) can cause transient URL-like objects to leak
  // into native APIs which causes occasional TypeError failures. Retry
  // the DB select once on such failures to improve resilience during dev.
  try {
    let rows: any[] = [];
    const maxAttempts = process.env.NODE_ENV === "production" ? 1 : 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        rows = await db
          .select({
            id: users.id,
            username: users.username,
            passwordHash: users.passwordHash,
            fullName: users.fullName,
            email: users.email,
            role: users.role,
            status: users.status,
            balanceUsd: users.balanceUsd,
            balanceEur: users.balanceEur,
            balanceEgp: users.balanceEgp,
            apiKey: users.apiKey,
            webhookUrl: users.webhookUrl,
            ipWhitelist: users.ipWhitelist,
            createdAt: users.createdAt,
            sessionExpiresAt: sessions.expiresAt,
          })
          .from(sessions)
          .innerJoin(users, eq(users.id, sessions.userId))
          .where(eq(sessions.tokenHash, sha256(token)))
          .limit(1);
        break;
      } catch (err: any) {
        const msg = String(err?.message ?? err);
        const isTransient = msg.includes("The \"path\" argument must be of type string") || err?.code === "ERR_INVALID_ARG_TYPE";
        if (attempt < maxAttempts && isTransient) {
          // eslint-disable-next-line no-console
          console.warn(`[ghost] transient db error (attempt ${attempt})`, err?.message ?? err);
          // small backoff
          await new Promise((r) => setTimeout(r, 60 * attempt));
          continue;
        }
        // rethrow to outer catch handler
        throw err;
      }
    }
    const row = rows[0];
    if (!row || row.status !== "active") return null;
    if (new Date(row.sessionExpiresAt).getTime() <= Date.now()) return null;
    const { sessionExpiresAt, ...user } = row;
    void sessionExpiresAt;
    // Populate in-memory cache for dev to make SSR resilient.
    try {
      if (process.env.NODE_ENV !== "production") {
        sessionCache.set(token, { user: user as any, expiresAt: new Date(row.sessionExpiresAt).getTime() });
      }
    } catch {}
    return user;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      try {
        // eslint-disable-next-line no-console
        console.error("[ghost] session lookup failed", error);
        // Log underlying cause if present (helps trace URL->path issues).
        const anyErr = error as any;
        if (anyErr && anyErr.cause) {
          // eslint-disable-next-line no-console
          console.error("[ghost] session lookup cause:", anyErr.cause);
          // eslint-disable-next-line no-console
          console.error("[ghost] session lookup cause.stack:", anyErr.cause.stack);
        }
        // eslint-disable-next-line no-console
        console.error("[ghost] session lookup current stack:", new Error().stack);
      } catch (e) {
        /* ignore logging problems */
      }
    }
    return null;
  }
}

/* ------------------------------------------------------------------ */

export interface SafeUser {
  id: number;
  username: string;
  fullName: string | null;
  email: string | null;
  role: string;
  status: string;
  balanceUsd: string;
  balanceEur: string;
  balanceEgp: string;
  apiKey: string | null;
  webhookUrl: string | null;
  ipWhitelist: string[];
  createdAt: string;
}

export function toSafeUser(u: User): SafeUser {
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    status: u.status,
    balanceUsd: u.balanceUsd,
    balanceEur: u.balanceEur,
    balanceEgp: u.balanceEgp,
    apiKey: u.apiKey,
    webhookUrl: u.webhookUrl,
    ipWhitelist: u.ipWhitelist ?? [],
    createdAt: new Date(u.createdAt).toISOString(),
  };
}
