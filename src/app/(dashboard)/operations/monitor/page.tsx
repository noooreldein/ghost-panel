"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Pause, Play, RadioTower } from "lucide-react";
import { apiGet, fmtDateTime } from "@/lib/client";
import { useMe } from "@/lib/use-me";
import {
  Badge,
  Btn,
  Card,
  CopyButton,
  EmptyState,
  PageHeader,
  StatusPill,
} from "@/components/ui";

interface MessageRow {
  id: number;
  msisdn: string;
  senderId?: string | null;
  body: string;
  otpCode?: string | null;
  status: string;
  latencyMs?: number | null;
  rate?: string | number;
  payout?: string | number;
  currency?: string;
  supplier?: string | null;
  isTest: boolean;
  direction?: string | null;
  destination?: string | null;
  createdAt: string;
  rangeName?: string | null;
  clientName?: string | null;
}

export default function LiveMonitorPage() {
  const me = useMe();
  const isAdmin = me?.role === "admin";
  const [rows, setRows] = useState<MessageRow[]>([]);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await apiGet<{ rows: MessageRow[] }>(
        "/api/sms/messages?limit=30&scope=all&page=1"
      );
      setError(null);
      if (data && Array.isArray(data.rows)) {
        setRows((prev) => {
          const combined = [...data.rows, ...prev];
          const map = new Map<number, MessageRow>();
          for (const item of combined) {
            if (!map.has(item.id)) {
              map.set(item.id, item);
            }
          }
          const sorted = Array.from(map.values()).sort((a, b) => b.id - a.id);
          return sorted.slice(0, 100);
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch live messages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (paused) return;

    void fetchMessages();

    // Weak-network friendly: poll only while the tab is visible (no hidden
    // background traffic) and stretch the interval after failed requests.
    let failures = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (document.visibilityState !== "visible") {
        timer = setTimeout(tick, 5000);
        return;
      }
      try {
        await fetchMessages();
        failures = 0;
      } catch {
        failures = Math.min(failures + 1, 5);
      }
      timer = setTimeout(tick, 5000 + failures * 5000);
    };
    timer = setTimeout(tick, 5000);

    const onVisible = () => {
      if (document.visibilityState === "visible" && !paused) void fetchMessages();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [paused, fetchMessages]);

  const togglePause = () => {
    setPaused((prev) => !prev);
  };

  return (
    <div>
      <PageHeader
        icon={RadioTower}
        title="Live Monitor"
        subtitle="Real-time tail of inbound and outbound traffic across the gateway."
        actions={
          <div className="flex items-center gap-3">
            {paused ? (
              <Badge tone="amber">PAUSED</Badge>
            ) : (
              <span className="tnum inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
                LIVE
              </span>
            )}
            <Btn variant="outline" icon={paused ? Play : Pause} onClick={togglePause}>
              {paused ? "Resume" : "Pause"}
            </Btn>
          </div>
        }
      />

      {error && (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">
          {error}
        </p>
      )}

      {loading && rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          Loading live feed…
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={RadioTower}
          title="No traffic detected"
          description="Inbound and outbound messages will appear here in real time."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const isOutbound = r.direction === "outbound";
            return (
              <Card key={r.id} className="p-4 transition-all hover:border-slate-300">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {isOutbound ? (
                      <Badge tone="violet">
                        <ArrowUpRight className="h-3 w-3 inline mr-0.5" strokeWidth={2} />
                        Outbound
                      </Badge>
                    ) : (
                      <Badge tone="blue">
                        <ArrowDownLeft className="h-3 w-3 inline mr-0.5" strokeWidth={2} />
                        Inbound
                      </Badge>
                    )}

                    {r.isTest && <Badge tone="amber">TEST</Badge>}

                    <span className="tnum font-bold text-slate-900">{r.msisdn}</span>

                    {isOutbound && r.destination && (
                      <span className="tnum text-xs font-medium text-slate-500">
                        → {r.destination}
                      </span>
                    )}

                    {r.senderId && (
                      <span className="text-xs font-medium text-slate-500">
                        from {r.senderId}
                      </span>
                    )}

                    {r.rangeName && <Badge tone="slate">{r.rangeName}</Badge>}
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusPill status={r.status} />
                    <span className="tnum text-[11.5px] text-slate-400">
                      {fmtDateTime(r.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="mt-2.5 flex items-start justify-between gap-4">
                  <p className="line-clamp-2 text-sm text-slate-600 leading-relaxed font-mono sm:font-sans">
                    {r.body}
                  </p>

                  {r.otpCode && (
                    <div className="shrink-0 flex items-center gap-1.5">
                      <Badge tone="blue" className="font-mono text-xs">
                        {r.otpCode}
                      </Badge>
                      <CopyButton value={r.otpCode} />
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
