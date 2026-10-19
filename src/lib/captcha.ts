import { randomBytes } from "crypto";
import { eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { captchaTickets } from "@/db/schema";
import { sha256 } from "@/lib/auth";

const CAPTCHA_TTL_MS = 1000 * 60 * 5; // 5 minutes
const MEMORY_CAPTCHA_PREFIX = "mem_";

interface Challenge {
  question: string;
  answer: number;
}

interface MemoryTicket {
  answerHash: string;
  expiresAt: number;
}

const globalForCaptcha = globalThis as typeof globalThis & {
  __ghostCaptchaTickets?: Map<string, MemoryTicket>;
};

const memoryTickets = globalForCaptcha.__ghostCaptchaTickets ?? new Map<string, MemoryTicket>();

if (process.env.NODE_ENV !== "production") {
  globalForCaptcha.__ghostCaptchaTickets = memoryTickets;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function buildChallenge(): Challenge {
  const ops = ["+", "-", "*"] as const;
  const op = ops[randomInt(0, ops.length - 1)];
  let a = randomInt(2, 12);
  let b = randomInt(1, 9);

  if (op === "-" && b > a) [a, b] = [b, a];

  const answer = op === "+" ? a + b : op === "-" ? a - b : a * b;
  return { question: `${a} ${op} ${b} = ?`, answer };
}

function cleanupMemoryTickets(): void {
  const now = Date.now();
  for (const [id, ticket] of memoryTickets) {
    if (ticket.expiresAt < now) memoryTickets.delete(id);
  }
}

export async function createCaptcha(): Promise<{ id: string; question: string }> {
  const challenge = buildChallenge();
  const answerHash = sha256(String(challenge.answer));
  const expiresAt = new Date(Date.now() + CAPTCHA_TTL_MS);
  let id = randomBytes(16).toString("hex");

  try {
    await db.delete(captchaTickets).where(lt(captchaTickets.expiresAt, new Date())).catch(() => {});
    await db.insert(captchaTickets).values({
      id,
      answerHash,
      expiresAt,
    });
  } catch {
    cleanupMemoryTickets();
    id = `${MEMORY_CAPTCHA_PREFIX}${id}`;
    memoryTickets.set(id, { answerHash, expiresAt: expiresAt.getTime() });
  }

  return { id, question: challenge.question };
}

export async function verifyCaptcha(id: string, answer: string): Promise<boolean> {
  if (!id || !answer) return false;

  if (id.startsWith(MEMORY_CAPTCHA_PREFIX)) {
    const ticket = memoryTickets.get(id);
    memoryTickets.delete(id);
    if (!ticket) return false;
    if (ticket.expiresAt < Date.now()) return false;
    return ticket.answerHash === sha256(answer.trim().toLowerCase());
  }

  const rows = await db.select().from(captchaTickets).where(eq(captchaTickets.id, id)).limit(1);
  await db.delete(captchaTickets).where(eq(captchaTickets.id, id)).catch(() => {});
  const ticket = rows[0];
  if (!ticket) return false;
  if (ticket.expiresAt.getTime() < Date.now()) return false;
  return ticket.answerHash === sha256(answer.trim().toLowerCase());
}
