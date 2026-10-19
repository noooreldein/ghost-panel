import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { payoutAccounts } from "@/db/schema";
import { audit } from "@/lib/audit";
import { encryptSecret } from "@/lib/provider-secrets";
import { fail, ok, requireAuth, str } from "@/lib/http";

export const dynamic = "force-dynamic";
const METHODS = ["bank", "paypal", "crypto"];

function safe(row: typeof payoutAccounts.$inferSelect) {
  const { destinationCiphertext, ...account } = row;
  return account;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const rows = await db.select().from(payoutAccounts).where(eq(payoutAccounts.userId, auth.user!.id)).orderBy(desc(payoutAccounts.id));
  return ok({ accounts: rows.map(safe) });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (process.env.NODE_ENV === "production" && !process.env.PROVIDER_ENCRYPTION_KEY) return fail("يجب ضبط PROVIDER_ENCRYPTION_KEY قبل حفظ بيانات السحب.", 503);
  const body = await req.json().catch(() => ({}));
  const label = str(body.label);
  const method = str(body.method).toLowerCase();
  const accountHolder = str(body.accountHolder);
  const destination = str(body.destination);
  if (!label || label.length > 96) return fail("اسم الحساب مطلوب ويجب ألا يتجاوز 96 حرفًا.");
  if (!METHODS.includes(method)) return fail("طريقة السحب غير مدعومة.");
  if (destination.length < 4 || destination.length > 512) return fail("بيانات الوجهة غير صالحة.");
  const hint = `${"•".repeat(Math.max(4, Math.min(12, destination.length - 4)))}${destination.slice(-4)}`;
  const [account] = await db.insert(payoutAccounts).values({ userId: auth.user!.id, label, method, accountHolder: accountHolder || null, destinationCiphertext: encryptSecret(destination), destinationHint: hint }).returning();
  await audit(auth.user!.id, "payout_account.created", "payout_account", account.id, { label, method, destinationHint: hint });
  return ok({ account: safe(account) }, 201);
}

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  const status = str(body.status);
  if (!Number.isInteger(id) || id < 1 || !["active", "archived"].includes(status)) return fail("بيانات الحساب غير صالحة.");
  const [account] = await db.update(payoutAccounts).set({ status }).where(and(eq(payoutAccounts.id, id), eq(payoutAccounts.userId, auth.user!.id))).returning();
  if (!account) return fail("الحساب غير موجود.", 404);
  await audit(auth.user!.id, `payout_account.${status}`, "payout_account", id, { label: account.label });
  return ok({ account: safe(account) });
}
