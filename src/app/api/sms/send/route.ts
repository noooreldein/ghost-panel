import { eq } from "drizzle-orm";
import { db } from "@/db";
import { smsNumbers, users, type User } from "@/db/schema";
import { fail, getClientIp, isMsisdn, isSenderId, ok, str } from "@/lib/http";
import { recordOutbound } from "@/lib/send";
import { normalizeMsisdn } from "@/lib/sms";

export const dynamic = "force-dynamic";

function ipAllowed(user: User, ip: string): boolean {
  const list = user.ipWhitelist ?? [];
  if (!list.length) return true;
  return list.some((entry) => {
    if (entry.includes("/")) return ip.startsWith(entry.split("/")[0].split(".").slice(0, 3).join("."));
    return entry === ip;
  });
}

/**
 * External API route for sending outbound SMS.
 * Authenticates via x-api-key header and validates source IP whitelist.
 */
export async function POST(req: Request) {
  const apiKey = req.headers.get("x-api-key") ?? "";
  if (!apiKey) return fail("Missing x-api-key header.", 401);

  const rows = await db.select().from(users).where(eq(users.apiKey, apiKey)).limit(1);
  const user = rows[0];
  if (!user || user.status !== "active") return fail("Invalid API key.", 401);
  if (!ipAllowed(user, getClientIp(req))) return fail("Source IP is not whitelisted for this key.", 403);

  const body = await req.json().catch(() => ({}));

  const rawNum = str(body.number);
  if (!rawNum) return fail("Missing number parameter.", 400);

  const numMsisdn = normalizeMsisdn(rawNum);
  if (!isMsisdn(numMsisdn)) return fail("Invalid sender number (MSISDN).", 400);

  let targetNumber = (await db.select().from(smsNumbers).where(eq(smsNumbers.msisdn, numMsisdn)).limit(1))[0];
  if (!targetNumber) {
    const altMsisdn = numMsisdn.startsWith("+") ? numMsisdn.slice(1) : `+${numMsisdn}`;
    targetNumber = (await db.select().from(smsNumbers).where(eq(smsNumbers.msisdn, altMsisdn)).limit(1))[0];
  }
  if (!targetNumber) return fail("Number not found in inventory.", 404);

  if (targetNumber.assignedUserId !== user.id && user.role !== "admin") {
    return fail("You do not have access to this number.", 403);
  }

  let rawDests: string[] = [];
  if (Array.isArray(body.destinations)) {
    rawDests = body.destinations.map((d: unknown) => str(d)).filter(Boolean);
  } else if (body.destination) {
    rawDests = [str(body.destination)].filter(Boolean);
  }

  if (!rawDests.length) {
    return fail("Missing destination or destinations parameter.", 400);
  }

  if (rawDests.length > 100) {
    return fail("Batch limit exceeded (max 100 destinations).", 400);
  }

  const dests = rawDests.map((d) => normalizeMsisdn(d));
  for (const d of dests) {
    if (!isMsisdn(d)) {
      return fail(`Invalid destination number: ${d}`, 400);
    }
  }

  const cli = str(body.cli);
  if (!cli || !isSenderId(cli)) {
    return fail("Invalid CLI / Sender ID.", 400);
  }

  const message = str(body.message);
  if (!message) {
    return fail("Message body cannot be empty.", 400);
  }
  if (message.length > 1600) {
    return fail("Message body exceeds 1600 characters limit.", 400);
  }

  const ids: number[] = [];
  for (const dest of dests) {
    const { id } = await recordOutbound({
      number: targetNumber,
      destination: dest,
      cli,
      message,
    });
    ids.push(id);
  }

  return ok({ count: ids.length, ids, message: "SMS sent successfully" }, 201);
}
