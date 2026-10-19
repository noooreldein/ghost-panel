import { count, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  agentRangeLimits,
  announcements,
  auditEvents,
  cliRoutes,
  clients,
  creditNotes,
  ledgerEntries,
  panelSettings,
  paymentRequests,
  payoutAccounts,
  smsMessages,
  smsNumbers,
  smsProviders,
  smsRanges,
  users,
} from "@/db/schema";
import { audit } from "@/lib/audit";
import { fail, ok, requireAuth } from "@/lib/http";

export const dynamic = "force-dynamic";

function formatDateStamp(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = now.getUTCFullYear();
  const mm = pad(now.getUTCMonth() + 1);
  const dd = pad(now.getUTCDate());
  const hh = pad(now.getUTCHours());
  const min = pad(now.getUTCMinutes());
  const ss = pad(now.getUTCSeconds());
  return `${yyyy}${mm}${dd}-${hh}${min}${ss}`;
}

export async function GET(req: Request) {
  const auth = await requireAuth(["admin"]);
  if (auth.error || !auth.user) return auth.error ?? fail("Unauthorized", 401);

  const url = new URL(req.url);
  const isMeta = url.searchParams.get("meta") === "1";

  if (isMeta) {
    const [
      cUsers,
      cClients,
      cSmsRanges,
      cSmsNumbers,
      cSmsMessages,
      cPaymentRequests,
      cLedgerEntries,
      cCliRoutes,
      cSmsProviders,
      cCreditNotes,
      cAgentRangeLimits,
      cAnnouncements,
      cAuditEvents,
    ] = await Promise.all([
      db.select({ value: count() }).from(users),
      db.select({ value: count() }).from(clients),
      db.select({ value: count() }).from(smsRanges),
      db.select({ value: count() }).from(smsNumbers),
      db.select({ value: count() }).from(smsMessages),
      db.select({ value: count() }).from(paymentRequests),
      db.select({ value: count() }).from(ledgerEntries),
      db.select({ value: count() }).from(cliRoutes),
      db.select({ value: count() }).from(smsProviders),
      db.select({ value: count() }).from(creditNotes),
      db.select({ value: count() }).from(agentRangeLimits),
      db.select({ value: count() }).from(announcements),
      db.select({ value: count() }).from(auditEvents),
    ]);

    const counts = {
      users: cUsers[0]?.value ?? 0,
      clients: cClients[0]?.value ?? 0,
      smsRanges: cSmsRanges[0]?.value ?? 0,
      smsNumbers: cSmsNumbers[0]?.value ?? 0,
      smsMessages: cSmsMessages[0]?.value ?? 0,
      paymentRequests: cPaymentRequests[0]?.value ?? 0,
      ledgerEntries: cLedgerEntries[0]?.value ?? 0,
      cliRoutes: cCliRoutes[0]?.value ?? 0,
      smsProviders: cSmsProviders[0]?.value ?? 0,
      creditNotes: cCreditNotes[0]?.value ?? 0,
      agentRangeLimits: cAgentRangeLimits[0]?.value ?? 0,
      announcements: cAnnouncements[0]?.value ?? 0,
      auditEvents: cAuditEvents[0]?.value ?? 0,
    };

    return ok({ counts });
  }

  const [
    allUsers,
    allClients,
    allRanges,
    allNumbers,
    recentMessages,
    allPayReqs,
    allLedger,
    allCli,
    allProviders,
    allPayoutAccs,
    allAnnouncements,
    allSettings,
    allAgentLimits,
    allCreditNotes,
    recentAudit,
  ] = await Promise.all([
    db.select().from(users),
    db.select().from(clients),
    db.select().from(smsRanges),
    db.select().from(smsNumbers).limit(50000),
    db.select().from(smsMessages).orderBy(desc(smsMessages.createdAt)).limit(20000),
    db.select().from(paymentRequests),
    db.select().from(ledgerEntries),
    db.select().from(cliRoutes),
    db.select().from(smsProviders),
    db.select().from(payoutAccounts),
    db.select().from(announcements),
    db.select().from(panelSettings),
    db.select().from(agentRangeLimits),
    db.select().from(creditNotes),
    db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(5000),
  ]);

  const redactedProviders = allProviders.map((p) => ({
    ...p,
    username: "[redacted]",
    credentials: "[redacted]",
  }));

  const redactedPayoutAccounts = allPayoutAccs.map((a) => ({
    ...a,
    destinationCiphertext: "[redacted]",
  }));

  const counts = {
    users: allUsers.length,
    clients: allClients.length,
    smsRanges: allRanges.length,
    smsNumbers: allNumbers.length,
    smsMessages: recentMessages.length,
    paymentRequests: allPayReqs.length,
    ledgerEntries: allLedger.length,
    cliRoutes: allCli.length,
    smsProviders: redactedProviders.length,
    payoutAccounts: redactedPayoutAccounts.length,
    announcements: allAnnouncements.length,
    panelSettings: allSettings.length,
    agentRangeLimits: allAgentLimits.length,
    creditNotes: allCreditNotes.length,
    auditEvents: recentAudit.length,
  };

  await audit(auth.user.id, "backup.export", "panel", null, { counts });

  const snapshot = {
    version: 1,
    generatedAt: new Date().toISOString(),
    data: {
      users: allUsers,
      clients: allClients,
      smsRanges: allRanges,
      smsNumbers: allNumbers,
      smsMessages: recentMessages,
      paymentRequests: allPayReqs,
      ledgerEntries: allLedger,
      cliRoutes: allCli,
      smsProviders: redactedProviders,
      payoutAccounts: redactedPayoutAccounts,
      announcements: allAnnouncements,
      panelSettings: allSettings,
      agentRangeLimits: allAgentLimits,
      creditNotes: allCreditNotes,
      auditEvents: recentAudit,
    },
  };

  const stamp = formatDateStamp();
  return new NextResponse(JSON.stringify(snapshot, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="ghost-panel-backup-${stamp}.json"`,
    },
  });
}
