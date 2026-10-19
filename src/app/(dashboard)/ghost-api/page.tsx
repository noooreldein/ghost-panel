"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Globe2, KeyRound, ListPlus, RefreshCw, Save, ShieldCheck, Trash2, Webhook } from "lucide-react";
import { apiGet, apiPatch } from "@/lib/client";
import type { SafeUser } from "@/lib/auth";
import { Badge, Btn, Card, CopyButton, cx, Field, Input, PageHeader } from "@/components/ui";

interface EndpointDoc {
  method: "GET" | "POST" | "PATCH";
  path: string;
  title: string;
  detail: string;
}

const DOCS: EndpointDoc[] = [
  { method: "POST", path: "/api/ingest", title: "Ingest inbound SMS", detail: "Push one message or a batch (max 100). Header: x-api-key. Auto OTP extraction, range resolution & webhook forwarding." },
  { method: "GET", path: "/api/sms/messages", title: "Query message log", detail: "Filter by from/to/status/q/scope. Append format=csv for export." },
  { method: "GET", path: "/api/sms/stats/overview", title: "Aggregated stats", detail: "Daily series + totals. Swap overview for ranges / numbers / clients." },
  { method: "GET", path: "/api/cli-routes", title: "CLI route lookup", detail: "?number=<dialled> — returns longest-prefix production route match." },
  { method: "GET", path: "/api/health", title: "Service health", detail: "Gateway + database liveness probe." },
];

const METHOD_TONE: Record<string, string> = {
  GET: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  POST: "bg-blue-50 text-blue-700 ring-blue-600/20",
  PATCH: "bg-amber-50 text-amber-700 ring-amber-600/20",
};

export default function GhostApiPage() {
  const [me, setMe] = useState<SafeUser | null>(null);
  const [reveal, setReveal] = useState(false);
  const [webhook, setWebhook] = useState("");
  const [ips, setIps] = useState<string[]>([]);
  const [ipInput, setIpInput] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  const load = useCallback(() => {
    apiGet<{ user: SafeUser }>("/api/settings")
      .then((d) => {
        setMe(d.user);
        setWebhook(d.user.webhookUrl ?? "");
        setIps(d.user.ipWhitelist ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load settings."));
  }, []);

  useEffect(() => {
    load();
    setOrigin(window.location.origin);
  }, [load]);

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2600);
  }

  async function patch(body: Record<string, unknown>, tag: string, okMsg: string) {
    setSaving(tag);
    setError(null);
    try {
      const d = await apiPatch<{ user: SafeUser }>("/api/settings", body);
      setMe(d.user);
      flash(okMsg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(null);
    }
  }

  function addIp(e: FormEvent) {
    e.preventDefault();
    const v = ipInput.trim();
    if (!v) return;
    if (ips.includes(v)) return;
    setIps((l) => [...l, v]);
    setIpInput("");
  }

  const masked = me?.apiKey ? `${me.apiKey.slice(0, 12)}${"•".repeat(18)}${me.apiKey.slice(-4)}` : "—";

  return (
    <div>
      <PageHeader
        icon={KeyRound}
        title="Ghost API"
        subtitle="Credentials, webhook callbacks and network restrictions for your integration."
      />

      {notice && (
        <p className="animate-fade-up mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-700">
          <ShieldCheck className="h-4 w-4" strokeWidth={1.9} />
          {notice}
        </p>
      )}
      {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* API key */}
        <Card className="relative overflow-hidden p-5">
          <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-blue-500/[0.07] blur-2xl" />
          <div className="flex items-start justify-between">
            <h3 className="flex items-center gap-2 text-[14.5px] font-bold text-slate-900">
              <KeyRound className="h-4 w-4 text-blue-600" strokeWidth={1.9} />
              Live secret key
            </h3>
            <Badge tone="blue">REST</Badge>
          </div>
          <p className="mt-1 text-[12.5px] text-slate-400">Send as <code className="tnum font-semibold text-slate-600">x-api-key</code> on every ingestion call.</p>

          <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-950 px-4 py-3.5">
            <code className="tnum flex-1 select-all overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-semibold text-sky-300">
              {reveal ? me?.apiKey ?? "—" : masked}
            </code>
            <button
              onClick={() => setReveal((r) => !r)}
              className="text-slate-400 transition-colors hover:text-white"
              aria-label="Toggle key visibility"
            >
              {reveal ? <EyeOff className="h-4 w-4" strokeWidth={1.9} /> : <Eye className="h-4 w-4" strokeWidth={1.9} />}
            </button>
          </div>

          <div className="mt-3.5 flex gap-2">
            <CopyButton value={me?.apiKey ?? ""} label="Copy key" className="h-9 flex-1 justify-center" />
            <Btn
              variant="outline"
              icon={RefreshCw}
              loading={saving === "key"}
              onClick={() => {
                if (confirm("Rotate the API key? The previous key stops working immediately.")) {
                  patch({ action: "regenerate" }, "key", "API key rotated — update your suppliers.");
                }
              }}
            >
              Rotate
            </Btn>
          </div>
        </Card>

        {/* webhook */}
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-[14.5px] font-bold text-slate-900">
            <Webhook className="h-4 w-4 text-blue-600" strokeWidth={1.9} />
            Webhook callback URL
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-slate-400">
            Inbound messages are POSTed as JSON (<code className="tnum text-slate-600">sms.inbound</code>) to this endpoint the moment they land.
          </p>
          <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] leading-relaxed text-slate-500">
            Requests include <code className="tnum">X-Ghost-Timestamp</code> and <code className="tnum">X-Ghost-Signature</code>. Verify the HMAC-SHA256 signature over <code className="tnum">timestamp.body</code> with this API key.
          </p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              patch({ webhookUrl: webhook }, "webhook", "Webhook callback saved.");
            }}
          >
            <Input
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              placeholder="https://your-endpoint.example/hooks/ghost"
              className="tnum"
            />
            <div className="flex items-center justify-between">
              <Badge tone={me?.webhookUrl ? "emerald" : "slate"}>{me?.webhookUrl ? "FORWARDING ACTIVE" : "NOT CONFIGURED"}</Badge>
              <Btn type="submit" size="sm" icon={Save} loading={saving === "webhook"}>
                Save webhook
              </Btn>
            </div>
          </form>
        </Card>

        {/* IP whitelist */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-[14.5px] font-bold text-slate-900">
                <Globe2 className="h-4 w-4 text-blue-600" strokeWidth={1.9} />
                IP whitelist
              </h3>
              <p className="mt-1 max-w-lg text-[12.5px] leading-relaxed text-slate-400">
                Restrict ingestion to known supplier egress IPs. Leave empty to accept any source with a valid key.
              </p>
            </div>
            <Badge tone={ips.length ? "amber" : "slate"}>{ips.length ? `${ips.length} RESTRICTION${ips.length > 1 ? "S" : ""}` : "OPEN ACCESS"}</Badge>
          </div>

          <form onSubmit={addIp} className="mt-4 flex gap-2">
            <Input value={ipInput} onChange={(e) => setIpInput(e.target.value)} placeholder="203.0.113.10 or 203.0.113.0/24" className="tnum max-w-sm" />
            <Btn type="submit" variant="outline" icon={ListPlus}>
              Add
            </Btn>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            {ips.length === 0 && <p className="text-[12.5px] text-slate-400">No entries — any source IP may present this key.</p>}
            {ips.map((ip) => (
              <span key={ip} className="tnum inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-semibold text-slate-600">
                {ip}
                <button onClick={() => setIps((l) => l.filter((x) => x !== ip))} className="text-slate-400 transition-colors hover:text-rose-600" aria-label={`Remove ${ip}`}>
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </span>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <Btn size="sm" icon={Save} loading={saving === "ips"} onClick={() => patch({ ipWhitelist: ips }, "ips", "IP whitelist updated.")}>
              Save whitelist
            </Btn>
          </div>
        </Card>
      </div>

      {/* docs */}
      <Card className="mt-4">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-[14.5px] font-bold text-slate-900">Endpoint reference</h3>
          <p className="mt-0.5 text-[12.5px] text-slate-400">REST over HTTPS · JSON bodies · cookie (dashboard) or x-api-key (machine) auth.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {DOCS.map((d) => (
            <div key={d.path + d.title} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <span className={cx("tnum w-16 rounded-lg px-2 py-1 text-center text-[11px] font-bold ring-1 ring-inset", METHOD_TONE[d.method])}>
                {d.method}
              </span>
              <code className="tnum text-[12.5px] font-bold text-slate-800">{d.path}</code>
              <div className="min-w-[240px] flex-1">
                <p className="text-[13px] font-semibold text-slate-800">{d.title}</p>
                <p className="text-[12px] leading-relaxed text-slate-400">{d.detail}</p>
              </div>
              <CopyButton value={`${origin}${d.path}`} label="URL" />
            </div>
          ))}
        </div>
        <div className="border-t border-slate-100 bg-slate-950 px-5 py-4" style={{ borderRadius: "0 0 1rem 1rem" }}>
          <p className="tnum mb-2 text-[9.5px] font-bold tracking-[0.24em] text-slate-500">QUICK TEST</p>
          <pre className="tnum overflow-x-auto text-[11.5px] leading-relaxed text-slate-300">
{`curl -X POST ${origin || "https://your-host"}/api/ingest \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${me?.apiKey ? masked : "gk_live_…"}" \\
  -d '{"msisdn":"+447700900123","senderId":"VERIFY","body":"Your code is 481516"}'`}
          </pre>
        </div>
      </Card>
    </div>
  );
}
