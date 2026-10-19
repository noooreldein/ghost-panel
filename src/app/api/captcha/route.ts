import { createCaptcha } from "@/lib/captcha";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { id, question } = await createCaptcha();
    return Response.json({ ok: true, id, question });
  } catch {
    return Response.json({ ok: false, error: "Could not generate a challenge. Please retry." }, { status: 500 });
  }
}
