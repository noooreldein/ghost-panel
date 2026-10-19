import { db } from "@/db";
import { auditEvents } from "@/db/schema";

/** Records administrative activity without ever writing credentials or message content. */
export async function audit(
  actorId: number | null,
  action: string,
  entityType: string,
  entityId?: string | number | null,
  details: Record<string, unknown> = {}
): Promise<void> {
  try {
    await db.insert(auditEvents).values({
      actorId,
      action,
      entityType,
      entityId: entityId === undefined || entityId === null ? null : String(entityId),
      details,
    });
  } catch (error) {
    // Auditing must never block an operational change; errors remain visible in server logs.
    console.error("[ghost] audit event could not be stored", error);
  }
}
