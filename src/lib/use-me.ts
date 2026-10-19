"use client";

import { useEffect, useState } from "react";
import { apiGetCached } from "@/lib/client";
import type { SafeUser } from "@/lib/auth";

/** Fetches the currently authenticated user (client components). */
export function useMe(): SafeUser | null {
  const [me, setMe] = useState<SafeUser | null>(null);
  useEffect(() => {
    let active = true;
    apiGetCached<{ user: SafeUser }>("/api/settings", 30000)
      .then((d) => active && setMe(d.user))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return me;
}
