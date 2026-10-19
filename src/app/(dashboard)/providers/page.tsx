"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowDown, ArrowUp, Check, CirclePause, CirclePlay, Globe2, LockKeyhole, Plus, PlugZap, Radio, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";
import { Badge, Btn, Card, Field, Input, PageHeader, Select } from "@/components/ui";

type Protocol = "http_rest" | "smpp" | "smpp_tls" | "webhook" | "soap";
type Provider = {
  id: number; name: string; protocol: Protocol; endpoint: string | null; username: string | null; status: string;
  priority: number; pollIntervalSeconds: number; healthStatus: string; healthNote: string | null;
  lastHealthCheckAt: string | null; credentialsSet: boolean;
};

const protocols: { id: Protocol; label: string; detail: string; icon: typeof Globe2 }[] = [
  { id: "http_rest", label: "HTTP / REST", detail: "واجهات المزودين الحديثة", icon: Globe2 },
  { id: "smpp", label: "SMPP 3.4", detail: "ربط بوابات الرسائل", icon: Radio },
  { id: "smpp_tls", label: "SMPP over TLS", detail: "اتصال SMPP مشفر", icon: ShieldCheck },
  { id: "webhook", label: "Webhook", detail: "استقبال أحداث HTTP", icon: Activity },
  { id: "soap", label: "SOAP", detail: "تكاملات XML القديمة", icon: PlugZap },
];
const blankForm = { name: "", protocol: "http_rest" as Protocol, endpoint: "", username: "", secret: "", priority: "100", pollIntervalSeconds: "30" };

async function callApi(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || "تعذر إكمال الطلب.");
  return data;
}

function healthTone(status: string): "blue" | "rose" | "slate" {
  return status === "ready" ? "blue" : status === "needs_attention" ? "rose" : "slate";
}
function healthLabel(status: string): string {
  return status === "ready" ? "جاهز" : status === "needs_attention" ? "يحتاج مراجعة" : "لم يُفحص";
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [validating, setValidating] = useState<number | null>(null);
  const [form, setForm] = useState(blankForm);

  const load = useCallback(async () => {
    setLoading(true);
    try { const data = await callApi("/api/providers"); setProviders(data.providers); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر تحميل المزودين."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function addProvider(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await callApi("/api/providers", { method: "POST", body: JSON.stringify({ ...form, priority: Number(form.priority), pollIntervalSeconds: Number(form.pollIntervalSeconds) }) });
      setModal(false); setForm(blankForm); setNotice("تمت إضافة المزود وتشفير بيانات الاعتماد."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر حفظ المزود."); }
    finally { setBusy(false); }
  }
  async function patch(provider: Provider, change: Record<string, unknown>) {
    try { await callApi("/api/providers", { method: "PATCH", body: JSON.stringify({ id: provider.id, ...change }) }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر تحديث المزود."); }
  }
  async function remove(provider: Provider) {
    if (!window.confirm(`حذف المزود «${provider.name}»؟`)) return;
    try { await callApi(`/api/providers?id=${provider.id}`, { method: "DELETE" }); setNotice("تم حذف المزود."); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر حذف المزود."); }
  }
  async function validate(provider: Provider) {
    setValidating(provider.id); setError("");
    try { const result = await callApi(`/api/providers/${provider.id}/validate`, { method: "POST" }); setNotice(result.note); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "تعذر فحص الإعداد."); }
    finally { setValidating(null); }
  }

  const sorted = [...providers].sort((a, b) => a.priority - b.priority);
  return <div>
    <PageHeader title="مزودو الاتصال" subtitle="أدر بوابات الرسائل، البروتوكولات وأولوية المسارات من مكان واحد." icon={PlugZap} actions={<Btn icon={Plus} onClick={() => { setError(""); setModal(true); }}>إضافة مزود</Btn>} />
    <div className="mb-5 grid gap-3 sm:grid-cols-3">{[
      { label: "إجمالي المزودين", value: providers.length, hint: "بوابات مسجلة" },
      { label: "جاهزة للربط", value: providers.filter((p) => p.healthStatus === "ready").length, hint: "إعداد تم التحقق منه" },
      { label: "أنواع البروتوكول", value: protocols.length, hint: "قابلة للتهيئة" },
    ].map((stat) => <Card key={stat.label} className="p-4"><p className="text-xs text-slate-500">{stat.label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{stat.value}</p><p className="mt-1 text-xs text-slate-400">{stat.hint}</p></Card>)}</div>
    <Card className="mb-5 overflow-hidden"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">البروتوكولات المتاحة</h2><p className="mt-1 text-xs text-slate-500">تدعم اللوحة إعداد الموصلات، بينما يحتاج الإرسال الفعلي إلى محول بروتوكول مخصص ومصرّح به لدى المزود.</p></div><div className="grid gap-px bg-slate-100 sm:grid-cols-2 lg:grid-cols-5">{protocols.map(({ id, label, detail, icon: Icon }) => <div key={id} className="bg-white p-4"><Icon className="mb-3 h-4 w-4 text-blue-600"/><p className="text-sm font-semibold text-slate-800">{label}</p><p className="mt-1 text-[11px] text-slate-400">{detail}</p></div>)}</div></Card>
    {notice && <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><Check className="h-4 w-4"/>{notice}<button onClick={() => setNotice("")} className="ml-auto"><X className="h-4 w-4"/></button></div>}
    {error && !modal && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
    <Card><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-semibold text-slate-900">قائمة المزودين</h2><p className="mt-1 text-xs text-slate-500">الأولوية الأقل تعني تجربة المسار أولًا.</p></div><Badge tone="blue">{providers.length} مزود</Badge></div>
      {loading ? <div className="p-10 text-center text-sm text-slate-400">جارٍ التحميل…</div> : sorted.length === 0 ? <div className="p-10 text-center"><PlugZap className="mx-auto h-8 w-8 text-slate-300"/><p className="mt-3 font-medium text-slate-700">لا يوجد مزودون بعد</p><p className="mt-1 text-sm text-slate-400">أضف أول بوابة لبدء إعداد مسارات الاتصال.</p></div> : <div className="divide-y divide-slate-100">{sorted.map((provider, index) => { const info = protocols.find((p) => p.id === provider.protocol)!; const Icon = info.icon; return <div key={provider.id} className="flex flex-wrap items-center gap-4 px-5 py-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon className="h-5 w-5"/></div><div className="min-w-[210px] flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{provider.name}</p><Badge tone={provider.status === "active" ? "emerald" : "amber"}>{provider.status === "active" ? "نشط" : "متوقف"}</Badge><Badge tone={healthTone(provider.healthStatus)}>{healthLabel(provider.healthStatus)}</Badge></div><p className="mt-1 text-xs text-slate-500">{info.label} · {provider.endpoint || "بدون عنوان"}</p>{provider.healthNote && <p className="mt-1 text-[11px] text-slate-400">{provider.healthNote}</p>}</div><div className="hidden text-xs text-slate-500 md:block"><p>{provider.username || "لا يوجد اسم مستخدم"}</p><p className="mt-1 text-slate-400">{provider.credentialsSet ? "بيانات الاعتماد مشفرة" : "لا يوجد سر محفوظ"}</p><p className="mt-1 text-slate-400">فحص كل {provider.pollIntervalSeconds} ثانية</p></div><Badge>أولوية {provider.priority}</Badge><div className="flex gap-1"><button title="فحص الإعداد" onClick={() => void validate(provider)} disabled={validating === provider.id} className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 disabled:opacity-30"><RefreshCw className={validating === provider.id ? "h-4 w-4 animate-spin" : "h-4 w-4"}/></button><button title="رفع الأولوية" onClick={() => { if (index > 0) { void patch(provider, { priority: sorted[index - 1].priority }); void patch(sorted[index - 1], { priority: provider.priority }); } }} disabled={index === 0} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="h-4 w-4"/></button><button title="خفض الأولوية" onClick={() => { if (index < sorted.length - 1) { void patch(provider, { priority: sorted[index + 1].priority }); void patch(sorted[index + 1], { priority: provider.priority }); } }} disabled={index === sorted.length - 1} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="h-4 w-4"/></button><button title={provider.status === "active" ? "إيقاف" : "تفعيل"} onClick={() => void patch(provider, { status: provider.status === "active" ? "paused" : "active" })} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">{provider.status === "active" ? <CirclePause className="h-4 w-4"/> : <CirclePlay className="h-4 w-4"/>}</button><button title="حذف المزود" onClick={() => void remove(provider)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4"/></button></div></div>; })}</div>}
    </Card>
    {modal && <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(false); }}><form onSubmit={addProvider} className="my-auto w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl sm:p-6"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-lg font-bold text-slate-900">إضافة مزود اتصال</h2><p className="mt-1 text-sm text-slate-500">تشفّر بيانات الاعتماد ولا تظهر بعد الحفظ.</p></div><button type="button" onClick={() => setModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5"/></button></div>{error && <div className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}<div className="grid gap-4 sm:grid-cols-2"><Field label="اسم المزود"><Input required maxLength={128} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: بوابة القاهرة الرئيسية"/></Field><Field label="البروتوكول"><Select value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value as Protocol })}>{protocols.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select></Field><Field label="عنوان الخدمة" hint="HTTP URL أو smpp://host:2775"><Input value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} placeholder="https://gateway.example/api"/></Field><Field label="الأولوية"><Input required type="number" min="1" max="9999" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}/></Field><Field label="اسم المستخدم"><Input autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="اختياري"/></Field><Field label="كلمة المرور / API key"><Input type="password" autoComplete="new-password" value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} placeholder="تُشفر قبل التخزين"/></Field><Field label="فاصل المراقبة بالثواني"><Input required type="number" min="5" max="3600" value={form.pollIntervalSeconds} onChange={(e) => setForm({ ...form, pollIntervalSeconds: e.target.value })}/></Field></div><div className="mt-5 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0"/>اضبط PROVIDER_ENCRYPTION_KEY ثابتًا في بيئة الإنتاج لتبقى بيانات الاعتماد قابلة للفك بعد إعادة التشغيل.</div><div className="mt-5 flex justify-end gap-2"><Btn type="button" variant="outline" onClick={() => setModal(false)}>إلغاء</Btn><Btn type="submit" loading={busy} icon={Plus}>حفظ المزود</Btn></div></form></div>}
  </div>;
}
