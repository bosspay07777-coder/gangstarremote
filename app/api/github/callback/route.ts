import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code || !process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET)
    return NextResponse.redirect(new URL("/integrations?github=erro", url.origin));
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code }),
  });
  const { access_token } = await res.json();
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (user && access_token) {
    await sb.from("integrations").upsert({ user_id: user.id, provider: "github", config: { token: encrypt(access_token) } }, { onConflict: "user_id,provider" });
  }
  return NextResponse.redirect(new URL("/integrations?github=ok", url.origin));
}
