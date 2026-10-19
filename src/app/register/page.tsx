import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import RegisterScreen from "@/components/register-screen";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  return <RegisterScreen />;
}
