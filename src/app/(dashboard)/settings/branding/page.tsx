"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Palette, Save, Type } from "lucide-react";
import { apiGet, apiPatch } from "@/lib/client";
import { useMe } from "@/lib/use-me";
import { Badge, Btn, Card, Field, Input, PageHeader, cx } from "@/components/ui";

interface ThemeDef {
  key: string;
  label: string;
  desc: string;
  primary: string;
  swatch: [string, string, string];
}

interface PanelSettingsRow {
  panelName: string;
  primaryColor: string;
  theme: string;
  themeLabel: string;
}

/** White icon disappears on light accents — switch to ink when luminance is high. */
function swatchIconTone(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const v = m[1];
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b > 150) ? "#0f172a" : "#ffffff";
}

export default function BrandingPage() {
  const router = useRouter();
  const me = useMe();
  const [themes, setThemes] = useState<ThemeDef[]>([]);
  const [panelName, setPanelName] = useState("Ghost Panel");
  const [theme, setTheme] = useState("ghost");
  const [customColor, setCustomColor] = useState("#2563eb");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<{ settings: PanelSettingsRow; themes: ThemeDef[] }>("/api/settings");
      setThemes(data.themes);
      setPanelName(data.settings.panelName);
      setTheme(data.settings.theme);
      setCustomColor(data.settings.primaryColor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load branding settings.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await apiPatch("/api/settings", {
        panelName,
        theme,
        primaryColor: theme === "custom" ? customColor : undefined,
      });
      setSaved(true);
      // Re-render server layout so the whole panel picks up the new identity.
      router.refresh();
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save branding settings.");
    } finally {
      setSaving(false);
    }
  }

  const isAdmin = me === null || me?.role === "admin";

  return (
    <div>
      <PageHeader
        icon={Palette}
        title="Branding & Themes"
        subtitle="White-label the console: panel name and accent theme applied across the entire panel instantly."
      />

      {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      {saved && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <Check className="h-4 w-4" /> Branding applied. Every page now uses the new identity.
        </p>
      )}

      <form onSubmit={save} className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card className="p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 to-blue-500 text-white shadow-md shadow-blue-600/25">
              <Type className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Panel identity</h2>
              <p className="text-xs text-slate-500">Shown in the topbar and browser metadata.</p>
            </div>
          </div>
          <Field label="Panel name" hint="Max 100 characters.">
            <Input value={panelName} onChange={(e) => setPanelName(e.target.value)} maxLength={100} required />
          </Field>
        </Card>

        <Card className="p-6">
          <div className="mb-5">
            <h2 className="font-semibold text-slate-900">Custom accent</h2>
            <p className="text-xs text-slate-500">Only used when the Custom theme is selected.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setTheme("custom");
                setSaved(false);
              }}
              className={cx(
                "flex flex-1 items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all",
                theme === "custom" ? "border-blue-500 bg-blue-50/50 shadow-md" : "border-slate-200 hover:border-slate-300"
              )}
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 shadow-sm"
                style={{ background: customColor }}
              >
                <Palette
                  className="h-5 w-5"
                  strokeWidth={1.75}
                  style={{ color: swatchIconTone(customColor) }}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">Custom</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">Pick any hex accent; the whole blue ramp is derived from it.</p>
              </div>
              {theme === "custom" && <Badge tone="blue">Selected</Badge>}
            </button>
            <input
              type="color"
              value={customColor}
              onChange={(e) => {
                setCustomColor(e.target.value);
                setTheme("custom");
                setSaved(false);
              }}
              className="h-[76px] w-16 shrink-0 cursor-pointer rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm transition-all hover:border-blue-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/10"
              aria-label="Custom accent color"
              title="Pick a custom accent color"
            />
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <div className="mb-5">
            <h2 className="font-semibold text-slate-900">Theme gallery</h2>
            <p className="text-xs text-slate-500">
              Ported from the Flash panel white-label system. Each theme recolors buttons, navigation, badges and the login art.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {themes.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTheme(t.key);
                  setSaved(false);
                }}
                className={cx(
                  "group rounded-2xl border-2 p-4 text-left transition-all",
                  theme === t.key ? "border-blue-500 bg-blue-50/50 shadow-md" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md"
                    style={{ background: t.primary, boxShadow: `0 8px 20px -8px ${t.primary}` }}
                  >
                    <Palette className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  {theme === t.key && <Badge tone="blue">Selected</Badge>}
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">{t.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{t.desc}</p>
                <div className="mt-3 flex gap-1.5">
                  {t.swatch.map((c) => (
                    <span key={c} className="h-5 w-5 rounded-full border border-slate-900/10" style={{ background: c }} />
                  ))}
                </div>
              </button>
            ))}
          </div>
        </Card>

        <div className="flex justify-end lg:col-span-2">
          <Btn type="submit" icon={Save} loading={saving} disabled={!isAdmin}>
            Apply branding
          </Btn>
        </div>
      </form>
    </div>
  );
}
