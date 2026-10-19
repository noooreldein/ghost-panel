import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { smsNumbers, smsRanges } from "@/db/schema";
import { audit } from "@/lib/audit";
import { fail, ok, requireAuth, str } from "@/lib/http";
import { normalizeMsisdn } from "@/lib/sms";

export const dynamic = "force-dynamic";

/** Bulk inventory provisioning from newline, comma, or JSON list input. */
export async function POST(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => ({}));
  const raw: unknown[] = Array.isArray(body.numbers) ? body.numbers : str(body.numbers).split(/[\s,;]+/);
  const normalized: string[] = raw.map((value: unknown) => normalizeMsisdn(str(value)));
  const candidates: string[] = [...new Set(normalized.filter((value) => /^\+?[0-9]{7,15}$/.test(value)))];
  if (!candidates.length) return fail("أدخل رقمًا واحدًا صالحًا على الأقل.");
  if (candidates.length > 1000) return fail("الاستيراد محدود بـ1000 رقم في العملية الواحدة.");
  const rangeId = body.rangeId ? Number(body.rangeId) : null;
  if (rangeId) {
    const [range] = await db.select({ id: smsRanges.id }).from(smsRanges).where(eq(smsRanges.id, rangeId)).limit(1);
    if (!range) return fail("النطاق المختار غير موجود.", 404);
  }
  const existing = await db.select({ msisdn: smsNumbers.msisdn }).from(smsNumbers).where(inArray(smsNumbers.msisdn, candidates));
  const known = new Set(existing.map((row) => row.msisdn));
  const values = candidates.filter((number) => !known.has(number)).map((msisdn) => ({ msisdn, rangeId, source: "bulk_import", notes: str(body.notes) || null }));
  if (values.length) await db.insert(smsNumbers).values(values);
  await audit(auth.user!.id, "numbers.imported", "sms_numbers", null, { received: candidates.length, inserted: values.length, skipped: known.size, rangeId });
  return ok({ received: candidates.length, inserted: values.length, skipped: known.size }, 201);
}
