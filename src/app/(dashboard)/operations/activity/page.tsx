"use client";

import { useCallback, useEffect, useState } from "react";
import { History, RefreshCw, ShieldCheck } from "lucide-react";
import { apiGet, fmtDateTime } from "@/lib/client";
import { Badge, Btn, Card, PageHeader } from "@/components/ui";

type Event = { id: number; action: string; entityId: string | null; details: Record<string, unknown>; createdAt: string; actorName: string | null; actorUsername: string | null };
const labels: Record<string, string> = { "provider.created": "تمت إضافة مزود", "provider.updated": "تم تحديث مزود", "provider.deleted": "تم حذف مزود", "provider.configuration_validated": "تم فحص إعداد مزود", "announcement.published": "تم نشر تحديث", "announcement.archived": "تمت أرشفة تحديث" };

export default function ActivityPage() {
  const [events, setEvents] = useState<Event[] | null>(null); const [error, setError] = useState(""); const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async (manual = false) => { if (manual) setRefreshing(true); try { const data = await apiGet<{ events: Event[] }>("/api/audit-events?limit=100"); setEvents(data.events); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "تعذر تحميل سجل النشاط."); } finally { setRefreshing(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  return <div><PageHeader icon={History} title="سجل النشاط" subtitle="سجل تشغيلي للتغييرات الإدارية الحساسة." actions={<Btn variant="outline" icon={RefreshCw} loading={refreshing} onClick={() => void load(true)}>تحديث</Btn>}/>{error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}<Card>{events === null ? <div className="p-10 text-center text-sm text-slate-400">جارٍ التحميل…</div> : events.length === 0 ? <div className="p-10 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-slate-300"/><p className="mt-3 font-semibold text-slate-700">لا توجد أحداث بعد</p><p className="mt-1 text-sm text-slate-400">ستظهر هنا تغييرات المزودين والتحديثات المنشورة.</p></div> : <div className="divide-y divide-slate-100">{events.map((event) => <div key={event.id} className="flex gap-3 p-5"><div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-700"><ShieldCheck className="h-4 w-4"/></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{labels[event.action] ?? event.action}</p><Badge tone="slate">{event.action}</Badge></div><p className="mt-1 text-xs text-slate-500">بواسطة {event.actorName || event.actorUsername || "حساب محذوف"} · {fmtDateTime(event.createdAt)}</p>{Object.keys(event.details || {}).length > 0 && <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">{JSON.stringify(event.details, null, 2)}</pre>}</div></div>)}</div>}</Card></div>;
}
