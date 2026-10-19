"use client";

import ConnectionBanner from "@/components/connection-banner";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  Ghost,
  Loader2,
  LockKeyhole,
  Radio,
  RefreshCw,
  ShieldCheck,
  User2,
  UserPlus2,
  Waves,
  Zap,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/client";

interface CaptchaState {
  id: string;
  question: string;
}

const FEATURES = [
  { icon: Waves, label: "LIVE TERMINATION PIPELINE" },
  { icon: Zap, label: "OTP EXTRACTION ENGINE" },
  { icon: ShieldCheck, label: "MULTI-CURRENCY LEDGER" },
];

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captcha, setCaptcha] = useState<CaptchaState | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(true);
  const [spinKey, setSpinKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const answerRef = useRef<HTMLInputElement>(null);

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    setCaptchaAnswer("");
    setSpinKey((k) => k + 1);
    try {
      const data = await apiGet<CaptchaState & { ok: true }>("/api/captcha");
      setCaptcha({ id: data.id, question: data.question });
    } catch {
      setCaptcha(null);
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCaptcha();
    apiGet<{ needsSetup: boolean }>("/api/setup")
      .then((d) => setNeedsSetup(!!d.needsSetup))
      .catch(() => {});
  }, [loadCaptcha]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await apiPost("/api/auth/login", {
        username,
        password,
        captchaId: captcha?.id ?? "",
        captchaAnswer,
      });
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Please retry.");
      setShakeKey((k) => k + 1);
      loadCaptcha();
      answerRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function bootstrap() {
    setLoading(true);
    setError(null);
    try {
      await apiPost("/api/setup", {});
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bootstrap failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-slate-100 lg:grid-cols-[1.05fr_1fr]">
      <ConnectionBanner />
      {/* ---------- brand / art panel ---------- */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 lg:block">
        <div className="bg-grid-light absolute inset-0" />
        <div className="absolute -left-40 top-1/3 h-[480px] w-[480px] rounded-full bg-blue-600/25 blur-[130px]" />
        <div className="absolute bottom-0 right-0 h-[380px] w-[380px] rounded-full bg-sky-400/15 blur-[120px]" />

        {/* radar */}
        <div className="animate-float absolute right-16 top-20 hidden xl:block">
          <div className="relative h-44 w-44 rounded-full border border-white/15">
            <div className="absolute inset-4 rounded-full border border-white/10" />
            <div className="absolute inset-10 rounded-full border border-white/10" />
            <div
              className="animate-radar absolute inset-0 rounded-full"
              style={{ background: "conic-gradient(from 0deg, rgba(56,189,248,0.45), transparent 18%)" }}
            />
            <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300" />
            <div className="animate-pulse-dot-blue absolute left-[30%] top-[38%] h-1.5 w-1.5 rounded-full bg-sky-300" />
            <div className="animate-pulse-dot-blue absolute left-[66%] top-[62%] h-1.5 w-1.5 rounded-full bg-emerald-300" style={{ animationDelay: "0.9s" }} />
          </div>
        </div>

        {/* signal bars */}
        <div className="absolute bottom-14 right-16 flex h-16 items-end gap-1.5 opacity-80">
          {[0.5, 0.75, 1, 0.65, 0.9, 0.45].map((h, i) => (
            <span
              key={i}
              className="signal-bar w-1.5 rounded-full bg-gradient-to-t from-sky-400/30 to-sky-300"
              style={{ height: `${h * 100}%`, animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </div>

        <div className="relative z-10 flex h-full flex-col justify-between p-14">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur">
              <Ghost className="h-5 w-5 text-white" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-white">Ghost Panel</p>
              <p className="tnum text-[10px] font-medium tracking-[0.28em] text-sky-300/90">SMS TERMINATION HUB</p>
            </div>
          </div>

          <div className="max-w-md">
            <p className="tnum mb-4 text-[11px] font-semibold tracking-[0.3em] text-sky-300/80">CARRIER-GRADE CONSOLE</p>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-white xl:text-5xl">
              Route live traffic.
              <br />
              <span className="bg-gradient-to-r from-sky-300 to-blue-200 bg-clip-text text-transparent">
                Extract every code.
              </span>
            </h1>
            <p className="mt-5 text-sm leading-relaxed text-slate-300/80">
              One control plane for your ranges, numbers, suppliers and payouts — with a hardened REST pipeline
              built for OTP traffic at scale.
            </p>
            <div className="mt-8 flex flex-wrap gap-2.5">
              {FEATURES.map((f) => (
                <span
                  key={f.label}
                  className="tnum inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[10px] font-medium tracking-[0.14em] text-slate-200"
                >
                  <f.icon className="h-3.5 w-3.5 text-sky-300" strokeWidth={1.75} />
                  {f.label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-slate-400">
            <Radio className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.75} />
            <p className="tnum text-[10px] tracking-[0.22em]">INGESTION GATEWAY · ONLINE</p>
          </div>
        </div>
      </aside>

      {/* ---------- form panel ---------- */}
      <main className="relative flex items-center justify-center overflow-hidden px-5 py-10 sm:px-10">
        <div className="bg-dots absolute inset-0" />
        <div className="absolute -top-32 right-0 h-72 w-72 rounded-full bg-blue-500/10 blur-[100px]" />

        <div className="animate-fade-up relative z-10 w-full max-w-[420px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 to-blue-500 shadow-lg shadow-blue-600/25">
              <Ghost className="h-5 w-5 text-white" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-base font-bold tracking-tight text-slate-900">Ghost Panel</p>
              <p className="tnum text-[9px] font-medium tracking-[0.28em] text-blue-600">SMS TERMINATION HUB</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-8 shadow-[0_12px_48px_-16px_rgb(15_23_42/0.18)] sm:p-9">
            <div className="mb-7">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Operator sign-in</h2>
              <p className="mt-1 text-[13px] text-slate-500">
                Authenticate to access the termination console.
              </p>
            </div>

            {error && (
              <div
                key={shakeKey}
                className="animate-shake mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700"
              >
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
                {error}
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[12px] font-semibold tracking-wide text-slate-600">USERNAME</label>
                <div className="group relative">
                  <User2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-600" strokeWidth={1.75} />
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    placeholder="operator.id"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[12px] font-semibold tracking-wide text-slate-600">PASSWORD</label>
                <div className="group relative">
                  <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-600" strokeWidth={1.75} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••••"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-11 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
                  </button>
                </div>
              </div>

              {/* ---------- captcha widget ---------- */}
              <div>
                <label className="mb-1.5 flex items-center justify-between text-[12px] font-semibold tracking-wide text-slate-600">
                  SECURITY CHECK
                  <span className="tnum text-[9px] font-medium tracking-[0.18em] text-slate-400">ONE-TIME TICKET</span>
                </label>
                <div className="flex items-stretch gap-2.5">
                  <div className="relative flex min-w-[112px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-slate-50 px-3">
                    {captchaLoading || !captcha ? (
                      <span className="skeleton h-5 w-16" />
                    ) : (
                      <span key={captcha.id} className="tnum animate-fade-in text-[15px] font-semibold tracking-wider text-blue-800">
                        {captcha.question}
                      </span>
                    )}
                    <span className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-[8px] font-semibold uppercase tracking-[0.3em] text-blue-300">
                      verify
                    </span>
                  </div>
                  <input
                    ref={answerRef}
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value.replace(/[^\d-]/g, ""))}
                    inputMode="numeric"
                    placeholder="?"
                    className="tnum h-11 w-20 rounded-xl border border-slate-200 bg-slate-50/60 text-center text-sm font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    required
                  />
                  <button
                    type="button"
                    onClick={loadCaptcha}
                    className="group flex w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 active:scale-90"
                    aria-label="Refresh captcha"
                    title="New challenge"
                  >
                    <RefreshCw
                      key={spinKey}
                      className="h-4 w-4 transition-transform duration-500"
                      style={{ transform: `rotate(${spinKey * 180}deg)` }}
                      strokeWidth={1.75}
                    />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative mt-2 flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-all hover:shadow-xl hover:shadow-blue-600/30 hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                    Verifying session…
                  </>
                ) : (
                  <>Access console</>
                )}
              </button>
            </form>

            {needsSetup && (
              <button
                onClick={bootstrap}
                disabled={loading}
                className="mt-3 w-full rounded-xl border border-dashed border-blue-300 bg-blue-50/60 px-4 py-2.5 text-[12.5px] font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-60"
              >
                First boot? Create the admin account &amp; continue
              </button>
            )}

            <div className="mt-5 border-t border-slate-100 pt-5 text-center">
              <p className="text-[12.5px] text-slate-500">معندكش حساب؟</p>
              <Link
                href="/register"
                className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50/60 text-[13px] font-semibold text-blue-700 transition-all hover:border-blue-300 hover:bg-blue-50 active:scale-[0.99]"
              >
                <UserPlus2 className="h-4 w-4" strokeWidth={2} />
                إنشاء حساب جديد · Create account
              </Link>
            </div>
          </div>

          <p className="tnum mt-6 text-center text-[10px] tracking-[0.18em] text-slate-400">
            SESSIONS PROTECTED · CAPTCHA-GATED · RESTRICTED ACCESS
          </p>
        </div>
      </main>
    </div>
  );
}
