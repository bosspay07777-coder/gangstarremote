import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";

/**
 * TokenHarbor — cabeça principal da API do agente.
 * GET: lista os modelos disponíveis na conta conectada (GET /v1/models real).
 * Usa a integração "tokenharbor" do usuário (chave criptografada) ou o
 * fallback do ambiente TOKENHARBOR_API_KEY.
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await sb
    .from("integrations")
    .select("config")
    .eq("user_id", user.id)
    .eq("provider", "tokenharbor")
    .single();

  let apiKey = "";
  if (data?.config?.api_key) {
    try { apiKey = decrypt(String(data.config.api_key)); } catch { apiKey = String(data.config.api_key); }
  }
  if (!apiKey && process.env.TOKENHARBOR_API_KEY) apiKey = process.env.TOKENHARBOR_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "TokenHarbor não conectado" }, { status: 404 });

  const r = await fetch("https://tokenharbor.ai/v1/models", {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  const j = await r.json().catch(() => ({}));
  return NextResponse.json({
    ok: r.ok,
    http: r.status,
    models: Array.isArray(j?.data) ? j.data.map((m: { id: string }) => m.id) : [],
  });
}
