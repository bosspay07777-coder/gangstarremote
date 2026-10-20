"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getClient } from "@/lib/supabase/client";

const MANIFEST = [
  { id: "github", name: "GitHub", icon: "🐙", fields: [{ k: "token", label: "Personal Access Token (scope repo)" }], oauth: true },
  { id: "openai", name: "OpenAI", icon: "🤖", fields: [{ k: "api_key", label: "API Key" }] },
  { id: "anthropic", name: "Anthropic", icon: "🧠", fields: [{ k: "api_key", label: "API Key" }] },
  { id: "gemini", name: "Google Gemini", icon: "✨", fields: [{ k: "api_key", label: "API Key" }] },
  { id: "openrouter", name: "OpenRouter", icon: "🌐", fields: [{ k: "api_key", label: "API Key" }] },
  { id: "vercel", name: "Vercel", icon: "▲", fields: [{ k: "token", label: "Access Token" }] },
  { id: "supabase", name: "Supabase", icon: "🟢", fields: [{ k: "url", label: "Project URL" }, { k: "anon", label: "Anon Key" }, { k: "service", label: "Service Role Key" }] },
  { id: "stripe", name: "Stripe", icon: "💳", fields: [{ k: "secret", label: "Secret Key" }] },
  { id: "resend", name: "Resend", icon: "📧", fields: [{ k: "api_key", label: "API Key" }] },
  { id: "mercadopago", name: "Mercado Pago / PIX", icon: "💸", fields: [{ k: "token", label: "Access Token" }] },
  { id: "figma", name: "Figma", icon: "🎨", fields: [{ k: "token", label: "Personal Token" }] },
  { id: "netlify", name: "Netlify", icon: "🏝", fields: [{ k: "token", label: "Access Token" }] },
];

export default function Integrations() {
  const [state, setState] = useState<any>({});
  const [vals, setVals] = useState<Record<string, string>>({});
  const load = async () => {
    const { data: { user } } = await getClient().auth.getUser();
    if (!user) { location.href = "/auth/signin"; return; }
    const j = await (await fetch("/api/keys")).json();
    const m: any = {};
    (j.integrations || []).forEach((r: any) => m[r.provider] = r.config);
    setState(m);
  };
  useEffect(() => { load(); }, []);
  const save = async (id: string) => {
    await fetch("/api/keys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider: id, config: vals }) });
    setVals({}); load();
  };
  const del = async (id: string) => { await fetch(`/api/keys?provider=${id}`, { method: "DELETE" }); load(); };
  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <Link href="/dashboard" className="text-xl font-bold">← GangstarRemote</Link>
      </header>
      <h1 className="text-3xl font-bold mb-2">Integrações</h1>
      <p className="text-muted text-sm mb-8">Chaves criptografadas com AES-256-GCM no servidor. Nunca expostas ao browser.</p>
      <div className="grid md:grid-cols-2 gap-4">
        {MANIFEST.map(mi => {
          const on = !!state[mi.id];
          return (
            <div key={mi.id} className="glass rounded-card p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold">{mi.icon} {mi.name}</div>
                {on ? <span className="text-xs text-green-400 bg-green-400/10 rounded-full px-2 py-0.5">conectado</span> : <span className="text-xs text-muted">desconectado</span>}
              </div>
              {mi.oauth && <a href={`https://github.com/apps/`} className="text-xs text-violet-400 underline">OAuth GitHub App (configure GITHUB_CLIENT_ID/SECRET) — ou use token abaixo</a>}
              <div className="space-y-2 mt-3">
                {mi.fields.map(f => (
                  on && state[mi.id]?.[f.k]
                    ? <div key={f.k} className="text-xs text-muted">• {f.label}: <span className="font-mono">{state[mi.id][f.k]}</span></div>
                    : <input key={f.k} placeholder={f.label} value={vals[f.k] || ""} onChange={e => setVals(v => ({ ...v, [f.k]: e.target.value }))} className="glow w-full bg-transparent border border-border1 rounded-input px-3 py-2 text-sm outline-none" />
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                {on
                  ? <button onClick={() => del(mi.id)} className="glass rounded-btn px-4 py-1.5 text-sm text-red-400">Desconectar</button>
                  : <button onClick={() => save(mi.id)} className="btn-grad glow rounded-btn px-4 py-1.5 text-sm font-semibold">Conectar</button>}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
