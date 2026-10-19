import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import LoginScreen from "@/components/login-screen";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  return <LoginScreen />;
}
