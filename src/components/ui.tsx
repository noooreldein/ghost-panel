"use client";

import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Check, Copy, Inbox, Loader2, X, type LucideIcon } from "lucide-react";

export const cx = (...cls: (string | false | null | undefined)[]) => cls.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ */
/*  Page header                                                       */
/* ------------------------------------------------------------------ */

export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
}) {
  useEffect(() => {
    document.title = `${title} — Ghost Panel`;
  }, [title]);

  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3.5">
        {Icon && (
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white text-blue-700 shadow-sm">
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Card                                                              */
/* ------------------------------------------------------------------ */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx("rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04),0_4px_16px_-4px_rgb(15_23_42/0.06)]", className)}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Buttons                                                           */
/* ------------------------------------------------------------------ */

type BtnVariant = "primary" | "outline" | "ghost" | "danger" | "dark";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: "sm" | "md";
  loading?: boolean;
  icon?: LucideIcon;
}

const btnVariants: Record<BtnVariant, string> = {
  primary:
    "bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/25 hover:brightness-110",
  outline: "border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50/50",
  ghost: "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
  danger: "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
  dark: "bg-slate-900 text-white hover:bg-slate-800",
};

export function Btn({ variant = "primary", size = "md", loading, icon: Icon, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" ? "h-8 px-3 text-[12.5px]" : "h-10 px-4 text-[13.5px]",
        btnVariants[variant],
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
      ) : (
        Icon && <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={1.9} />
      )}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Forms                                                             */
/* ------------------------------------------------------------------ */

const inputCls =
  "h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 text-[13.5px] text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 disabled:opacity-60";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(inputCls, className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputCls, "pr-8 appearance-none bg-none", className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(inputCls, "h-auto min-h-[92px] resize-y py-2.5 leading-relaxed", className)}
      {...rest}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold tracking-[0.08em] text-slate-500">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11.5px] text-slate-400">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Badges & status                                                   */
/* ------------------------------------------------------------------ */

type Tone = "blue" | "slate" | "emerald" | "amber" | "rose" | "violet";

const tones: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-700 ring-blue-600/20",
  slate: "bg-slate-100 text-slate-600 ring-slate-500/15",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  rose: "bg-rose-50 text-rose-700 ring-rose-600/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
};

export function Badge({ tone = "slate", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("tnum inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
  );
}

const statusTone: Record<string, Tone> = {
  delivered: "emerald",
  received: "blue",
  rejected: "rose",
  expired: "amber",
  active: "emerald",
  paused: "amber",
  blocked: "rose",
  suspended: "rose",
  pending: "amber",
  approved: "emerald",
};

export function StatusPill({ status }: { status: string }) {
  const tone = statusTone[status] ?? "slate";
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset", tones[tone])}>
      <span className="relative flex h-1.5 w-1.5">
        <span className={cx("h-1.5 w-1.5 rounded-full", dotColor(tone))} />
      </span>
      {status}
    </span>
  );
}

function dotColor(tone: Tone): string {
  return {
    blue: "bg-blue-500",
    slate: "bg-slate-400",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    violet: "bg-violet-500",
  }[tone];
}

export function statusToneDot(status: string): string {
  return dotColor(statusTone[status] ?? "slate");
}

/* ------------------------------------------------------------------ */
/*  Trend delta                                                       */
/* ------------------------------------------------------------------ */

export function StatDelta({ value }: { value: number | null }) {
  if (value === null || value === undefined) {
    return <Badge tone="slate">— vs last week</Badge>;
  }
  const up = value >= 0;
  return (
    <span
      className={cx(
        "tnum inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        up ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-rose-50 text-rose-700 ring-rose-600/20"
      )}
    >
      {up ? <ArrowUpRight className="h-3 w-3" strokeWidth={2.25} /> : <ArrowDownRight className="h-3 w-3" strokeWidth={2.25} />}
      {Math.abs(value)}% vs last week
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Table kit                                                         */
/* ------------------------------------------------------------------ */

export const thCls =
  "whitespace-nowrap border-b border-slate-200 bg-slate-50/70 px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-500 first:pl-5 last:pr-5";
export const tdCls = "border-b border-slate-100 px-4 py-3.5 text-[13px] text-slate-700 first:pl-5 last:pr-5 align-middle";

export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse">{children}</table>
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  colSpan,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  colSpan?: number;
}) {
  const content = (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-400">
        <Icon className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-slate-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
  if (colSpan) {
    return (
      <tr>
        <td colSpan={colSpan}>{content}</td>
      </tr>
    );
  }
  return content;
}

export function LoadingRows({ colSpan, rows = 5 }: { colSpan: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          <td colSpan={colSpan} className="px-5 py-3">
            <div className="skeleton h-5 w-full" style={{ animationDelay: `${i * 0.12}s` }} />
          </td>
        </tr>
      ))}
    </>
  );
}

export function Pagination({ page, limit, total, onPage }: { page: number; limit: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= 0) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
      <p className="tnum text-[11.5px] text-slate-400">
        PAGE {page} OF {pages} · {total} RECORDS
      </p>
      <div className="flex gap-1.5">
        <Btn size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Prev
        </Btn>
        <Btn size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Btn>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feedback                                                          */
/* ------------------------------------------------------------------ */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("h-5 w-5 animate-spin text-blue-600", className)} strokeWidth={2} />;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="text-[12px] font-bold underline underline-offset-2 hover:text-rose-900">
          Retry
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal                                                             */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="animate-fade-in absolute inset-0 bg-slate-950/40 backdrop-blur-[3px]" onClick={onClose} />
      <div
        className={cx(
          "animate-fade-up relative w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl",
          wide ? "max-w-2xl" : "max-w-md"
        )}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h3 className="text-[15px] font-bold tracking-tight text-slate-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-[12.5px] text-slate-500">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Copy button                                                       */
/* ------------------------------------------------------------------ */

export function CopyButton({ value, label, className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className={cx(
        "inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 px-2 text-[11px] font-semibold text-slate-500 transition-all hover:border-blue-300 hover:text-blue-600",
        copied && "border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:text-emerald-700",
        className
      )}
    >
      {copied ? <Check className="h-3 w-3" strokeWidth={2.5} /> : <Copy className="h-3 w-3" strokeWidth={2} />}
      {copied ? "Copied" : label ?? "Copy"}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Segmented control                                                 */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-100/80 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cx(
            "tnum rounded-[10px] font-semibold transition-all",
            size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-1.5 text-[12px]",
            value === opt.value
              ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
