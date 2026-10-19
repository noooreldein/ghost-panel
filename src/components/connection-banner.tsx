"use client";

import { useEffect, useState } from "react";
import { CloudOff } from "lucide-react";
import { bustGetCache } from "@/lib/client";

/**
 * Global connectivity sentinel. When the browser goes offline (or the panel
 * is opened on a dead link) a fixed banner explains the state and data
 * auto-refreshes the moment the network returns — no manual reload needed.
 */
export default function ConnectionBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    // Sync after paint (no setState in the effect body), then track live events.
    const probe = setTimeout(() => setOnline(navigator.onLine), 0);
    const goOnline = () => {
      setOnline(true);
      // Stale cache from the offline window must not survive reconnection.
      bustGetCache();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      clearTimeout(probe);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed inset-x-0 top-14 z-[80] animate-fade-in">
      <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-amber-50/95 px-4 py-2 shadow-lg backdrop-blur">
        <CloudOff className="h-4 w-4 animate-pulse text-amber-600" strokeWidth={2} />
        <p className="text-[12.5px] font-semibold text-amber-800">
          انقطع الاتصال بالسيرفر — هترجع البيانات تلقائي أول ما الشبكة ترجع
        </p>
      </div>
    </div>
  );
}
