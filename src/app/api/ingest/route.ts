import { eq, sql } from "drizzle-orm";
import { createHmac } from "crypto";
import { db } from "@/db";
import { smsMessages, smsNumbers, smsRanges, users, type User } from "@/db/schema";
import { fail, getClientIp, isMsisdn, ok, str } from "@/lib/http";
import { extractOtp, longestPrefixMatch, normalizeMsisdn } from "@/lib/sms";

export const dynamic = "force-dynamic";

const ALLOWED_STATUS = new Set(["received", "delivered", "rejected", "expired"]);

function ipAllowed(user: User, ip: string): boolean {
  const list = user.ipWhitelist ?? [];
  if (!list.length) return true;
  return list.some((entry) => {
    if (entry.includes("/")) return ip.startsWith(entry.split("/")[0].split(".").slice(0, 3).join("."));
    return entry === ip;
  });
}

async function fireWebhook(user: User, payload: unknown): Promise<void> {
  if (!user.webhookUrl) return;
  try {
    const body = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = user.apiKey
      ? createHmac("sha256", user.apiKey).update(`${timestamp}.${body}`).digest("hex")
      : "";
    await fetch(user.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "GhostPanel-Webhook/1.0",
        "X-Ghost-Event": "sms.inbound",
        "X-Ghost-Timestamp": timestamp,
        "X-Ghost-Signature": signature,
      },
      body,
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    /* delivery is best-effort; message is already stored */
  }
}

/**
 * Supplier ingestion endpoint (HTTP/SMPP bridge).
 *   POST /api/ingest        body: { msisdn, senderId, body, ... } | [...]
 *   Header: x-api-key: gk_live_...
 */
export async function POST(req: Request) {
  const apiKey = req.headers.get("x-api-key") ?? "";
  if (!apiKey) return fail("Missing x-api-key header.", 401);

  const rows = await db.select().from(users).where(eq(users.apiKey, apiKey)).limit(1);
  const user = rows[0];
  if (!user || user.status !== "active") return fail("Invalid API key.", 401);
  if (!ipAllowed(user, getClientIp(req))) return fail("Source IP is not whitelisted for this key.", 403);

  const payload = await req.json().catch(() => null);
  const items = Array.isArray(payload) ? payload : payload ? [payload] : [];
  if (!items.length) return fail("Empty payload.");
  if (items.length > 100) return fail("Batch limit exceeded (max 100 messages).");

  const ranges = await db.select().from(smsRanges).where(eq(smsRanges.status, "active"));
  const numbers = await db.select().from(smsNumbers);

  const values = [];
  const errors: { index: number; error: string }[] = [];

  for (let i = 0; i < items.length; i++) {
    const raw = items[i] ?? {};
    const msisdn = normalizeMsisdn(str(raw.msisdn));
    const text = str(raw.body ?? raw.message);
    if (!isMsisdn(msisdn)) {
      errors.push({ index: i, error: "invalid msisdn" });
      continue;
    }
    if (!text) {
      errors.push({ index: i, error: "empty body" });
      continue;
    }

    const matched = longestPrefixMatch(msisdn, ranges);
    const knownNumber = numbers.find((n) => n.msisdn.replace(/^\+/, "") === msisdn.replace(/^\+/, "")) ?? null;
    const status = ALLOWED_STATUS.has(str(raw.status)) ? str(raw.status) : "received";

    values.push({
      msisdn,
      senderId: str(raw.senderId ?? raw.cli) || null,
      body: text,
      otpCode: str(raw.otpCode ?? raw.code) || extractOtp(text),
      status,
      latencyMs: Number.isInteger(Number(raw.latencyMs)) ? Number(raw.latencyMs) : null,
      supplier: str(raw.supplier) || user.username,
      rangeId: matched?.id ?? knownNumber?.rangeId ?? null,
      numberId: knownNumber?.id ?? null,
      rate: str(raw.rate) || matched?.rate || "0",
      payout: str(raw.payout) || matched?.payout || "0",
      currency: str(raw.currency).toUpperCase() || matched?.currency || "USD",
      isTest: false,
    });

    if (knownNumber) {
      await db.update(smsNumbers).set({ lastMessageAt: new Date() }).where(eq(smsNumbers.id, knownNumber.id));
    }
  }

  if (!values.length) return fail("No valid messages in payload.", 422, { errors });

  const inserted = await db.insert(smsMessages).values(values).returning({ id: smsMessages.id });

  // forward to configured webhook callback (best effort)
  if (user.webhookUrl) {
    for (let i = 0; i < Math.min(inserted.length, 10); i++) {
      void fireWebhook(user, { event: "sms.inbound", id: inserted[i].id, ...values[i] });
    }
  }

  void sql;
  return ok({ accepted: inserted.length, ids: inserted.map((r) => r.id), rejected: errors.length, errors }, 201);
}
