import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const sb = await createClient();
    await sb.auth.exchangeCodeForSession(code);
  }
  const pending = url.searchParams.get("next") || "/dashboard";
  return NextResponse.redirect(new URL(pending, url.origin));
}
