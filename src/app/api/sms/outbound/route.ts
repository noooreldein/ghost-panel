import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { clients, smsMessages, smsNumbers, smsRanges } from "@/db/schema";
import { audit } from "@/lib/audit";
import { fail, isMsisdn, isSenderId, ok, pagination, requireAuth, str } from "@/lib/http";
import { recordOutbound } from "@/lib/send";
import { normalizeMsisdn } from "@/lib/sms";

export const dynamic = "force-dynamic";

/**
 * Internal API endpoint to list recent outbound messages.
 * Query: q (search destination/msisdn/body), page, limit.
 */
export async function GET(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;

  const url = new URL(req.url);
  const q = str(url.searchParams.get("q"));
  const { limit, offset, page } = pagination(url);

  const filters: SQL[] = [eq(smsMessages.direction, "outbound")];
  if (q) {
    filters.push(
      or(
        ilike(smsMessages.destination, `%${q}%`),
        ilike(smsMessages.msisdn, `%${q}%`),
        ilike(smsMessages.body, `%${q}%`)
      )!
    );
  }

  const where = and(...filters);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: smsMessages.id,
        msisdn: smsMessages.msisdn,
        senderId: smsMessages.senderId,
        body: smsMessages.body,
        destination: smsMessages.destination,
        status: smsMessages.status,
        isTest: smsMessages.isTest,
        createdAt: smsMessages.createdAt,
        rangeName: smsRanges.name,
        clientName: clients.name,
      })
      .from(smsMessages)
      .leftJoin(smsRanges, eq(smsMessages.rangeId, smsRanges.id))
      .leftJoin(clients, eq(smsMessages.clientId, clients.id))
      .where(where)
      .orderBy(desc(smsMessages.id))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(smsMessages).where(where),
  ]);

  return ok({
    total: totalRows[0]?.value ?? 0,
    page,
    rows: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

/**
 * Internal API endpoint to send single or bulk outbound SMS (Admin).
 * Body: { msisdn, destination | destinations, cli, message }
 */
export async function POST(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));

  const rawNum = str(body.msisdn);
  if (!rawNum) return fail("Missing sender msisdn.", 400);

  const numMsisdn = normalizeMsisdn(rawNum);
  if (!isMsisdn(numMsisdn)) return fail("Invalid sender number (MSISDN).", 400);

  let targetNumber = (await db.select().from(smsNumbers).where(eq(smsNumbers.msisdn, numMsisdn)).limit(1))[0];
  if (!targetNumber) {
    const altMsisdn = numMsisdn.startsWith("+") ? numMsisdn.slice(1) : `+${numMsisdn}`;
    targetNumber = (await db.select().from(smsNumbers).where(eq(smsNumbers.msisdn, altMsisdn)).limit(1))[0];
  }
  if (!targetNumber) return fail("Number not found in inventory.", 404);

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
    return fail("Maximum 100 destinations allowed.", 400);
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

  await audit(auth.user!.id, "sms.outbound_sent", "sms_messages", null, {
    count: ids.length,
    msisdn: targetNumber.msisdn,
    destinationsCount: dests.length,
  });

  return ok({ count: ids.length, ids }, 201);
}
