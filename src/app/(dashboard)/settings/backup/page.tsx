"use client";

import { useEffect, useState } from "react";
import { Database, Download, ShieldCheck } from "lucide-react";
import { apiGet, fmtNum } from "@/lib/client";
import { Btn, Card, PageHeader } from "@/components/ui";

const TABLE_LABELS: Record<string, string> = {
  users: "Users",
  clients: "Clients",
  smsRanges: "SMS Ranges",
  smsNumbers: "SMS Numbers",
  smsMessages: "SMS Messages",
  paymentRequests: "Payment Requests",
  ledgerEntries: "Ledger Entries",
  cliRoutes: "CLI Routes",
  smsProviders: "SMS Providers",
  creditNotes: "Credit Notes",
  agentRangeLimits: "Agent Range Limits",
  announcements: "Announcements",
  auditEvents: "Audit Events",
};

export default function BackupPage() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ counts: Record<string, number> }>("/api/backup?meta=1")
      .then((res) => {
        setCounts(res.counts);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load table counts.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <PageHeader
        icon={ShieldCheck}
        title="Backup & Export"
        subtitle="Full JSON snapshot of the panel's operating data — safe to archive or migrate."
      />

      {error && (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">
          {error}
        </p>
      )}

      <Card className="mb-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Export System Database</h2>
            <p className="mt-1 max-w-xl text-xs text-slate-500">
              Restore is manual: import the JSON into Supabase via the SQL editor or a script. Credentials and payout destinations are redacted in exports.
            </p>
          </div>
          <Btn
            icon={Download}
            onClick={() => {
              window.location.href = "/api/backup";
            }}
          >
            Download full backup
          </Btn>
        </div>
      </Card>

      <div className="mb-2">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
          Table Records Overview
        </h3>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Card key={i} className="p-4">
                <div className="skeleton mb-2 h-4 w-24" />
                <div className="skeleton h-6 w-16" />
              </Card>
            ))}
          </div>
        ) : counts ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Object.entries(counts).map(([key, countVal]) => (
              <Card key={key} className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <Database className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-500">
                    {TABLE_LABELS[key] ?? key}
                  </p>
                  <p className="tnum text-lg font-bold text-slate-900">
                    {fmtNum(countVal)}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
