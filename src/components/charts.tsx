"use client";

import { useId } from "react";
import { cx } from "@/components/ui";

/* ------------------------------------------------------------------ */
/*  Sparkline                                                         */
/* ------------------------------------------------------------------ */

export function Sparkline({
  values,
  className,
  height = 44,
  stroke = "#2563eb",
}: {
  values: number[];
  className?: string;
  height?: number;
  stroke?: string;
}) {
  const id = useId().replace(/[:]/g, "");
  const w = 160;
  const h = height;
  const safe = values.length ? values : [0, 0];
  const max = Math.max(...safe, 1);
  const step = w / Math.max(safe.length - 1, 1);
  const pts = safe.map((v, i) => `${(i * step).toFixed(1)},${(h - 5 - (v / max) * (h - 12)).toFixed(1)}`);
  const line = pts.join(" ");
  const area = `0,${h} ${line} ${w},${h}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cx("w-full", className)} style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sg-${id})`} />
      <polyline points={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Bar chart                                                         */
/* ------------------------------------------------------------------ */

export interface BarDatum {
  label: string;
  value: number;
  value2?: number;
  hint?: string;
}

export function Bars({
  data,
  height = 180,
  color = "#1d4ed8",
  color2 = "#93c5fd",
  legend,
}: {
  data: BarDatum[];
  height?: number;
  color?: string;
  color2?: string;
  legend?: [string, string];
}) {
  const max = Math.max(...data.map((d) => Math.max(d.value, d.value2 ?? 0)), 1);
  const allZero = data.every((d) => d.value === 0 && (d.value2 ?? 0) === 0);

  return (
    <div>
      {legend && (
        <div className="mb-3 flex items-center gap-4 text-[11px] font-medium text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} /> {legend[0]}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: color2 }} /> {legend[1]}
          </span>
        </div>
      )}
      <div className="relative">
        <div className="flex items-end gap-[6px]" style={{ height }}>
          {data.map((d, i) => (
            <div key={i} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-[3px]">
              {d.value2 !== undefined && (
                <div
                  className="w-full max-w-[22px] rounded-t-[5px] transition-all duration-500 group-hover:opacity-80"
                  style={{ height: `${Math.max((d.value2 / max) * 100, allZero ? 2 : 1.5)}%`, background: color2 }}
                />
              )}
              <div
                className="w-full max-w-[22px] rounded-t-[5px] transition-all duration-500 group-hover:brightness-110"
                style={{
                  height: `${Math.max((d.value / max) * 100, allZero ? 2 : 1.5)}%`,
                  background: `linear-gradient(180deg, ${color}, ${color}cc)`,
                }}
              />
              <div className="pointer-events-none absolute -top-9 z-10 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[10.5px] font-semibold text-white shadow-lg group-hover:block">
                {d.hint ?? `${d.label} — ${d.value}${d.value2 !== undefined ? ` / ${d.value2}` : ""}`}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-[6px] border-t border-slate-100 pt-2">
          {data.map((d, i) => (
            <div key={i} className="tnum flex-1 truncate text-center text-[9.5px] font-medium text-slate-400">
              {d.label}
            </div>
          ))}
        </div>
        {allZero && (
          <p className="tnum pointer-events-none absolute inset-x-0 top-[38%] text-center text-[11px] tracking-[0.2em] text-slate-300">
            AWAITING LIVE TRAFFIC
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Donut                                                             */
/* ------------------------------------------------------------------ */

export function Donut({
  slices,
  size = 148,
  thickness = 15,
  centerLabel,
  centerValue,
}: {
  slices: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
          {total > 0 &&
            slices.map((s, i) => {
              const frac = s.value / total;
              const dash = `${frac * c} ${c}`;
              const el = (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={thickness}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  className="transition-all duration-700"
                />
              );
              offset += frac * c;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tnum text-lg font-bold text-slate-900">{centerValue ?? total}</span>
          {centerLabel && <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{centerLabel}</span>}
        </div>
      </div>
      <div className="space-y-2">
        {slices.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-[12px]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
            <span className="font-medium capitalize text-slate-600">{s.label}</span>
            <span className="tnum font-semibold text-slate-900">{s.value}</span>
          </div>
        ))}
        {total === 0 && <p className="text-[12px] text-slate-400">No traffic recorded yet.</p>}
      </div>
    </div>
  );
}
