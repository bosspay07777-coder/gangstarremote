import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/crypto";
import { NextRequest } from "next/server";

export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data } = await sb.from("integrations").select("provider,config").eq("user_id", user.id);
  const out = (data || []).map((r: any) => ({
    provider: r.provider,
    config: Object.fromEntries(Object.entries(r.config || {}).map(([k, v]: any) => [k, String(v).includes(":") && String(v).split(":").length === 3 ? "••••" + String(v).slice(-4) : v])),
  }));
  return NextResponse.json({ integrations: out });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { provider, config } = await req.json();
  const enc: any = {};
  for (const [k, v] of Object.entries(config || {})) enc[k] = encrypt(String(v));
  const { error } = await sb.from("integrations").upsert({ user_id: user.id, provider, config: enc }, { onConflict: "user_id,provider" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const provider = new URL(req.url).searchParams.get("provider");
  await sb.from("integrations").delete().eq("user_id", user.id).eq("provider", provider);
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) { // internal: resolve keys
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { provider } = await req.json();
  const { data } = await sb.from("integrations").select("config").eq("user_id", user.id).eq("provider", provider).single();
  if (!data) return NextResponse.json({ error: "not configured" }, { status: 404 });
  const dec: any = {};
  for (const [k, v] of Object.entries(data.config || {})) dec[k] = decrypt(String(v));
  return NextResponse.json({ config: dec });
}
