"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Crosshair, Info, Plus, Route, ShieldAlert, SquareTerminal } from "lucide-react";
import { apiGet, apiPost, fmtNum, qs } from "@/lib/client";
import { useMe } from "@/lib/use-me";
import {
  Badge,
  Btn,
  Card,
  cx,
  EmptyState,
  Field,
  Input,
  LoadingRows,
  PageHeader,
  Pagination,
  Select,
  StatusPill,
  TableShell,
  tdCls,
  thCls,
} from "@/components/ui";

interface RouteRow {
  id: number;
  prefix: string;
  country: string;
  network: string | null;
  rate: string;
  currency: string;
  supplier: string | null;
  status: string;
}

const PAGE_LIMIT = 15;

export default function CliSearchPage() {
  const me = useMe();
  const isAdmin = me?.role === "admin";

  const [number, setNumber] = useState("");
  const [looking, setLooking] = useState(false);
  const [lookup, setLookup] = useState<{ query: string; match: RouteRow | null } | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [rows, setRows] = useState<RouteRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await apiGet<{ rows: RouteRow[]; total: number }>(`/api/cli-routes${qs({ q, page, limit: PAGE_LIMIT })}`);
      setRows(d.rows);
      setTotal(d.total);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load routes.");
      setRows([]);
    }
  }, [q, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function testLookup(e: FormEvent) {
    e.preventDefault();
    setLooking(true);
    setLookupError(null);
    setLookup(null);
    try {
      const d = await apiGet<{ match: RouteRow | null; query: string }>(`/api/cli-routes${qs({ number })}`);
      setLookup({ query: number, match: d.match });
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Lookup failed.");
    } finally {
      setLooking(false);
    }
  }

  async function addRoute(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    setFormError(null);
    try {
      await apiPost("/api/cli-routes", Object.fromEntries(fd.entries()));
      (e.target as HTMLFormElement).reset();
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not add route.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        icon={SquareTerminal}
        title="CLI Search"
        subtitle="Longest-prefix route resolution against the production CLI inventory."
      />

      {/* restriction banner */}
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4.5 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" strokeWidth={1.75} />
        <div className="text-[13px] leading-relaxed text-amber-800">
          <p className="font-bold">Lookup policy: TEST_LOOKUP_ONLY</p>
          <p>
            Standard accounts may run <strong>Test Lookups</strong> against the route table only. Provisioning or modifying
            production routes requires an administrator — contact <span className="tnum font-semibold">support@ghost-panel</span> or
            raise a ticket from the Clients desk.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        {/* lookup */}
        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 text-[14.5px] font-bold text-slate-900">
            <Crosshair className="h-4 w-4 text-blue-600" strokeWidth={1.9} />
            Test lookup
          </h3>
          <form onSubmit={testLookup} className="flex gap-2">
            <Input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Dialled number, e.g. 447700900123"
              className="tnum"
              required
            />
            <Btn type="submit" loading={looking}>
              Run lookup
            </Btn>
          </form>

          {lookupError && (
            <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] font-medium text-rose-700">{lookupError}</p>
          )}

          {lookup && (
            <div className="animate-fade-up mt-4">
              {lookup.match ? (
                <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/80 to-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="tnum text-[10px] font-bold tracking-[0.2em] text-blue-600">ROUTE MATCHED</p>
                    <Badge tone="blue">TEST RESULT</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {[
                      ["PREFIX", `+${lookup.match.prefix}`],
                      ["COUNTRY", lookup.match.country],
                      ["NETWORK", lookup.match.network ?? "—"],
                      ["RATE", `${lookup.match.rate} ${lookup.match.currency}`],
                      ["SUPPLIER", lookup.match.supplier ?? "—"],
                      ["STATUS", lookup.match.status.toUpperCase()],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-white/90 px-3 py-2 ring-1 ring-slate-100">
                        <p className="tnum text-[8.5px] font-bold tracking-[0.18em] text-slate-400">{k}</p>
                        <p className="tnum mt-0.5 truncate text-[13px] font-bold text-slate-900">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center">
                  <Route className="mx-auto h-6 w-6 text-slate-300" strokeWidth={1.5} />
                  <p className="mt-2 text-[13px] font-semibold text-slate-600">No production route covers +{lookup.query}</p>
                  <p className="mt-1 text-[12px] text-slate-400">
                    Contact your administrator to provision this destination before sending live traffic.
                  </p>
                </div>
              )}
            </div>
          )}

          <p className="mt-4 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-slate-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
            Test lookups are resolved read-only and never inject traffic or modify routing weights.
          </p>
        </Card>

        {/* admin provisioning */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[14.5px] font-bold text-slate-900">
              <Plus className="h-4 w-4 text-blue-600" strokeWidth={2} />
              Provision production route
            </h3>
            {!isAdmin && <Badge tone="amber">ADMIN ONLY</Badge>}
          </div>
          {isAdmin ? (
            <form onSubmit={addRoute} className="mt-4 grid grid-cols-2 gap-3">
              {formError && (
                <p className="col-span-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] font-medium text-rose-700">{formError}</p>
              )}
              <Field label="PREFIX">
                <Input name="prefix" placeholder="4477" className="tnum" required />
              </Field>
              <Field label="COUNTRY">
                <Input name="country" placeholder="United Kingdom" required />
              </Field>
              <Field label="NETWORK">
                <Input name="network" placeholder="EE" />
              </Field>
              <Field label="SUPPLIER">
                <Input name="supplier" placeholder="supplier-handle" />
              </Field>
              <Field label="RATE">
                <Input name="rate" placeholder="0.0120" inputMode="decimal" className="tnum" />
              </Field>
              <Field label="CURRENCY">
                <Select name="currency" defaultValue="USD">
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="EGP">EGP</option>
                </Select>
              </Field>
              <div className="col-span-2 flex justify-end">
                <Btn type="submit" icon={Plus} loading={saving}>
                  Add route
                </Btn>
              </div>
            </form>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center">
              <ShieldAlert className="mx-auto h-6 w-6 text-slate-300" strokeWidth={1.5} />
              <p className="mt-2 text-[13px] font-semibold text-slate-600">Provisioning locked</p>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
                Your role is limited to test lookups. Production route additions must be requested through support/admin.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* inventory */}
      <Card className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h3 className="text-[14.5px] font-bold text-slate-900">Route inventory</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setQ(qInput);
            }}
          >
            <Input className="tnum w-56" placeholder="Filter prefix / country…" value={qInput} onChange={(e) => setQInput(e.target.value)} />
          </form>
        </div>
        {error && <p className="m-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">{error}</p>}
        <TableShell>
          <thead>
            <tr>
              <th className={thCls}>Prefix</th>
              <th className={thCls}>Country</th>
              <th className={thCls}>Network</th>
              <th className={thCls}>Rate</th>
              <th className={thCls}>Supplier</th>
              <th className={thCls}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <LoadingRows colSpan={6} />
            ) : rows.length === 0 ? (
              <EmptyState
                colSpan={6}
                icon={Route}
                title="No CLI routes provisioned"
                description="The route table is empty. Administrators can provision production prefixes above — lookups then resolve in real time."
              />
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-slate-50/70">
                  <td className={tdCls}>
                    <Badge tone="blue" className="text-[11.5px]">+{r.prefix}</Badge>
                  </td>
                  <td className={cx(tdCls, "font-medium text-slate-800")}>{r.country}</td>
                  <td className={cx(tdCls, "text-slate-500")}>{r.network ?? "—"}</td>
                  <td className={cx(tdCls, "tnum font-semibold text-slate-900")}>
                    {r.rate} <span className="text-[10px] text-slate-400">{r.currency}</span>
                  </td>
                  <td className={cx(tdCls, "tnum text-slate-500")}>{r.supplier ?? "—"}</td>
                  <td className={tdCls}>
                    <StatusPill status={r.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
        <Pagination page={page} limit={PAGE_LIMIT} total={total} onPage={setPage} />
        <div className="border-t border-slate-100 px-5 py-3">
          <p className="tnum text-[10px] tracking-[0.18em] text-slate-400">
            {fmtNum(total)} PREFIXES · RESOLUTION VIA LONGEST-PREFIX MATCH
          </p>
        </div>
      </Card>
    </div>
  );
}
