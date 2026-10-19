import { db } from "@/db";
import { smsMessages, smsNumbers } from "@/db/schema";
import { extractOtp } from "@/lib/sms";

/**
 * Server-side shared helper to record an outbound SMS into sms_messages.
 * Validates nothing itself (caller validated).
 */
export async function recordOutbound(params: {
  number: typeof smsNumbers.$inferSelect;
  destination: string;
  cli: string;
  message: string;
}): Promise<{ id: number }> {
  const { number, destination, cli, message } = params;

  const [inserted] = await db
    .insert(smsMessages)
    .values({
      msisdn: number.msisdn,
      senderId: cli,
      body: message,
      otpCode: extractOtp(message),
      status: "delivered",
      direction: "outbound",
      destination,
      clientId: number.assignedClientId,
      numberId: number.id,
      rangeId: number.rangeId,
      isTest: false,
      rate: "0",
      payout: "0",
      currency: "USD",
    })
    .returning({ id: smsMessages.id });

  return { id: inserted.id };
}
