import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { smsMessages, smsRanges } from "@/db/schema";
import { fail, isMsisdn, isSenderId, ok, requireAuth, str } from "@/lib/http";
import { extractOtp, longestPrefixMatch, normalizeMsisdn } from "@/lib/sms";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const rows = await db
    .select()
    .from(smsMessages)
    .where(eq(smsMessages.isTest, true))
    .orderBy(desc(smsMessages.id))
    .limit(25);

  return ok({ rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) });
}

/**
 * Sandbox injection: simulates an inbound SMS for a number without touching
 * live termination routes. Performs the real OTP extraction + range matching
 * pipeline so integrators can validate parsing rules.
 */
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const msisdn = normalizeMsisdn(str(body.msisdn));
  const senderId = str(body.senderId) || "GHOST-TEST";
  const text = str(body.body);

  if (!isMsisdn(msisdn)) return fail("Recipient MSISDN must be a valid number (7-15 digits).");
  if (!isSenderId(senderId)) return fail("Sender ID must be up to 11 alphanumeric characters, or numeric.");
  if (!text) return fail("Message body is required.");
  if (text.length > 1000) return fail("Message body is too long (max 1000 chars).");

  /* Resolve matching range by longest-prefix to attach rate metadata */
  const ranges = await db.select().from(smsRanges).where(eq(smsRanges.status, "active"));
  const match = longestPrefixMatch(msisdn, ranges);

  const otp = extractOtp(text);
  const latencyMs = 60 + Math.floor(Math.random() * 360);

  const [row] = await db
    .insert(smsMessages)
    .values({
      msisdn,
      senderId,
      body: text,
      otpCode: otp,
      status: "delivered",
      latencyMs,
      supplier: "sandbox",
      isTest: true,
      rangeId: match?.id ?? null,
      rate: match?.rate ?? "0",
      payout: match?.payout ?? "0",
      currency: match?.currency ?? "USD",
    })
    .returning();

  return ok(
    {
      row: { ...row, createdAt: row.createdAt.toISOString() },
      extraction: { otp, matchedRange: match ? { id: match.id, name: match.name, prefix: match.prefix } : null },
    },
    201
  );
}
