import { NextResponse } from "next/server";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";

export async function GET(req: Request) {
  const cookie = req.headers.get("cookie") ?? null;
  const sessionCookie = cookie
    ? cookie.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${SESSION_COOKIE}=`)) ?? null
    : null;
  const user = await getSessionUser();
  return NextResponse.json({ ok: true, cookie, sessionCookie, hasSession: !!user, user: user ? { id: user.id, username: user.username } : null });
}
