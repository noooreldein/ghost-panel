import { inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { smsMessages, smsNumbers } from "@/db/schema";

/**
 * Row-visibility scoping for the "user edition" of the console.
 *
 * Non-admin accounts must never see platform-wide traffic or economics:
 * read paths filter to the numbers actually assigned to the account, and
 * commercial fields (supplier, payout, rate) are stripped server-side.
 */

/** Minimal structural role view (works with raw DB rows and SafeUser alike). */
export interface Principal {
  id: number;
  role: string;
}

export function isAdmin(user: Principal): boolean {
  return user.role === "admin";
}

/** All sms_numbers ids assigned to a user. Empty array = sees nothing. */
export async function assignedNumberIds(userId: number): Promise<number[]> {
  const rows = await db.select({ id: smsNumbers.id }).from(smsNumbers).where(inArray(smsNumbers.assignedUserId, [userId]));
  return rows.map((r) => r.id);
}

export type Visibility =
  | { kind: "admin" } // unrestricted
  | { kind: "none" } // has no numbers: must return an empty result
  | { kind: "own"; filter: SQL };

/**
 * Resolve message visibility for a user. Admins are unrestricted; regular
 * accounts are limited to messages on their assigned numbers.
 */
export async function messageVisibility(user: Principal): Promise<Visibility> {
  if (isAdmin(user)) return { kind: "admin" };
  const ids = await assignedNumberIds(user.id);
  if (ids.length === 0) return { kind: "none" };
  return { kind: "own", filter: inArray(smsMessages.numberId, ids) };
}

/**
 * Message field projection: commercial fields are internal-only and are
 * stripped for non-admin accounts.
 */
export function stripCommercial<T extends Record<string, unknown>>(fields: T, user: Principal): T {
  if (isAdmin(user)) return fields;
  const copy: Record<string, unknown> = { ...fields };
  delete copy.rate;
  delete copy.payout;
  delete copy.supplier;
  return copy as T;
}
