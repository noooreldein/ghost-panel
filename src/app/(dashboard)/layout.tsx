import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSessionUser, toSafeUser } from "@/lib/auth";
import { getPanelSettings } from "@/lib/settings";
import Shell from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const settings = await getPanelSettings();
  return <Shell user={toSafeUser(user)} settings={settings}>{children}</Shell>;
}
