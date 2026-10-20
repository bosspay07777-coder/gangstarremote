import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/crypto";
import { NextRequest } from "next/server";
import { PRESETS, testProvider, type ProviderConfig, type ProviderKind } from "@/lib/llm";

const DEFAULT_RESP_PATHS: Record<ProviderKind, string> = {
  openai: "choices[0].delta.content",
  openrouter: "choices[0].delta.content",
  tokenharbor: "choices[0].delta.content",
  github: "",
  supabase: "",
  anthropic: "__anthropic__",
  gemini: "candidates[0].content.parts[0].text",
  custom: "",
};

export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data } = await sb.from("integrations").select("provider,config,kind").eq("user_id", user.id);
  const out = (data || []).map((r: any) => {
    const cfg = r.config || {};
    const masked: any = { ...cfg };
    if (typeof masked.api_key === "string") masked.api_key = "••••" + masked.api_key.slice(-4);
    if (typeof masked.token === "string") masked.token = "••••" + masked.token.slice(-4);
    if (typeof masked.secret === "string") masked.secret = "••••" + masked.secret.slice(-4);
    return { provider: r.provider, kind: r.kind, config: masked, presets: PRESETS };
  });
  return NextResponse.json({ integrations: out });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const provider: string = String(body.provider || "").trim();
  if (!provider) return NextResponse.json({ error: "provider obrigatório" }, { status: 400 });
  const cfg: any = body.config || {};
  // encrypted secrets (api_key, token, secret, anon, service)
  const enc: any = { ...cfg };
  for (const k of ["api_key", "token", "secret", "anon", "service"]) {
    if (typeof enc[k] === "string" && enc[k] && !String(enc[k]).startsWith("••••")) {
      enc[k] = encrypt(enc[k]);
    }
  }
  const kind: ProviderKind = body.kind || (PRESETS as any)[provider]?.kind || "custom";
  // anexa response_path padrão se não vier
  if (!enc.response_path && kind !== "custom") enc.response_path = DEFAULT_RESP_PATHS[kind];
  if (kind !== "custom") enc.model = enc.model || (PRESETS as any)[kind]?.model;
  const { error } = await sb.from("integrations").upsert({ user_id: user.id, provider, kind, config: enc }, { onConflict: "user_id,provider" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const provider = new URL(req.url).searchParams.get("provider");
  await sb.from("integrations").delete().eq("user_id", user.id).eq("provider", provider!);
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const action = new URL(req.url).searchParams.get("action");
  if (action === "test") {
    const { provider } = await req.json();
    const { data } = await sb.from("integrations").select("config,kind").eq("user_id", user.id).eq("provider", provider).single();
    if (!data) return NextResponse.json({ error: "não conectado" }, { status: 404 });
    const dec: any = {}; for (const [k, v] of Object.entries(data.config || {})) dec[k] = decrypt(String(v));
    const p: ProviderConfig = { ...dec, kind: data.kind || "custom" };
    const apiKey = dec.api_key || dec.token || dec.secret || "";
    const r = await testProvider(p, apiKey);
    return NextResponse.json(r);
  }
  // resolve (uso interno do chat route)
  const { provider, projectId } = await req.json();
  let q = sb.from("integrations").select("config,kind").eq("user_id", user.id).eq("provider", provider);
  if (projectId) q = q.ilike("config->>project", `%${projectId}%`).or(`config->>project.is.null,config->>project.eq.`);
  const { data } = await q.single();
  if (!data) return NextResponse.json({ error: "não configurado" }, { status: 404 });
  const dec: any = {}; for (const [k, v] of Object.entries(data.config || {})) dec[k] = decrypt(String(v));
  return NextResponse.json({ config: dec, kind: data.kind });
}
