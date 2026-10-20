"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getClient } from "@/lib/supabase/client";

// Presets + Provedor Custom genérico
const PRESETS: { id: string; name: string; icon: string; kind: string; description: string; fields: { k: string; label: string; placeholder?: string }[]; defaults?: any }[] = [
  { id: "openai", name: "OpenAI", icon: "🤖", kind: "openai", description: "GPT-4o, GPT-4 Turbo, o1", fields: [{ k: "api_key", label: "API Key", placeholder: "sk-..." }], defaults: { base_url: "https://api.openai.com/v1/chat/completions" } },
  { id: "anthropic", name: "Anthropic (Claude)", icon: "🧠", kind: "anthropic", description: "Claude Sonnet / Opus / Haiku", fields: [{ k: "api_key", label: "API Key", placeholder: "sk-ant-..." }], defaults: { base_url: "https://api.anthropic.com/v1/messages" } },
  { id: "gemini", name: "Google Gemini", icon: "✨", kind: "gemini", description: "Gemini Flash / Pro", fields: [{ k: "api_key", label: "API Key" }], defaults: { base_url: "https://generativelanguage.googleapis.com/v1beta/models/" } },
  { id: "openrouter", name: "OpenRouter", icon: "🌐", kind: "openrouter", description: "200+ modelos via 1 chave", fields: [{ k: "api_key", label: "API Key", placeholder: "sk-or-..." }], defaults: { base_url: "https://openrouter.ai/api/v1/chat/completions" } },
  { id: "deepseek", name: "DeepSeek", icon: "🐋", kind: "custom", description: "OpenAI-compatible (deepseek-chat)", fields: [{ k: "api_key", label: "API Key" }], defaults: { base_url: "https://api.deepseek.com/v1/chat/completions", model: "deepseek-chat", auth_header: "Authorization", auth_prefix: "Bearer ", response_path: "choices[0].delta.content", request_template: { model: "${model}", stream: true, messages: "${messages}" } } },
  { id: "mistral", name: "Mistral", icon: "🌫️", kind: "custom", description: "OpenAI-compatible", fields: [{ k: "api_key", label: "API Key" }], defaults: { base_url: "https://api.mistral.ai/v1/chat/completions", model: "mistral-large-latest", auth_header: "Authorization", auth_prefix: "Bearer ", response_path: "choices[0].delta.content", request_template: { model: "${model}", stream: true, messages: "${messages}" } } },
  { id: "groq", name: "Groq", icon: "⚡", kind: "custom", description: "OpenAI-compatible, ultra rápido", fields: [{ k: "api_key", label: "API Key" }], defaults: { base_url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile", auth_header: "Authorization", auth_prefix: "Bearer ", response_path: "choices[0].delta.content", request_template: { model: "${model}", stream: true, messages: "${messages}" } } },
  { id: "xai", name: "xAI (Grok)", icon: "🅧", kind: "custom", description: "OpenAI-compatible", fields: [{ k: "api_key", label: "API Key" }], defaults: { base_url: "https://api.x.ai/v1/chat/completions", model: "grok-2-latest", auth_header: "Authorization", auth_prefix: "Bearer ", response_path: "choices[0].delta.content", request_template: { model: "${model}", stream: true, messages: "${messages}" } } },
  { id: "cohere", name: "Cohere", icon: "🌀", kind: "custom", description: "Custom (Cohere Chat v2)", fields: [{ k: "api_key", label: "API Key" }], defaults: { base_url: "https://api.cohere.com/v2/chat", model: "command-r-plus", auth_header: "Authorization", auth_prefix: "Bearer ", response_path: "delta.message.content.text", request_template: { model: "${model}", stream: true, messages: "${messages}" } } },
  { id: "github", name: "GitHub", icon: "🐙", kind: "github", description: "OAuth ou PAT (scope repo)", fields: [{ k: "token", label: "Personal Access Token", placeholder: "ghp_..." }] },
  { id: "vercel", name: "Vercel", icon: "▲", kind: "vercel", description: "Token para deploys", fields: [{ k: "token", label: "Access Token" }] },
  { id: "stripe", name: "Stripe", icon: "💳", kind: "stripe", description: "Pagamentos", fields: [{ k: "secret", label: "Secret Key" }] },
  { id: "resend", name: "Resend", icon: "📧", kind: "resend", description: "E-mail", fields: [{ k: "api_key", label: "API Key" }] },
  { id: "mercadopago", name: "Mercado Pago / PIX", icon: "💸", kind: "mercadopago", description: "Cobranças BR", fields: [{ k: "token", label: "Access Token" }] },
  { id: "figma", name: "Figma", icon: "🎨", kind: "figma", description: "Importar designs", fields: [{ k: "token", label: "Personal Token" }] },
  { id: "netlify", name: "Netlify", icon: "🏝", kind: "netlify", description: "Deploy alternativo", fields: [{ k: "token", label: "Access Token" }] },
];

export default function Integrations() {
  const [state, setState] = useState<any[]>([]);
  const [tab, setTab] = useState<"preset" | "custom">("preset");
  const [draft, setDraft] = useState<any>({
    provider: "meu-provedor", base_url: "https://api.example.com/v1/chat/completions",
    auth_header: "Authorization", auth_prefix: "Bearer ",
    headers: { "content-type": "application/json" },
    model: "modelo-x",
    request_template: { model: "${model}", stream: true, messages: "${messages}" },
    response_path: "choices[0].delta.content",
    api_key: "",
  });

  const load = async () => {
    const { data: { user } } = await getClient().auth.getUser();
    if (!user) { location.href = "/auth/signin"; return; }
    const j = await (await fetch("/api/keys")).json();
    setState(j.integrations || []);
  };
  useEffect(() => { load(); }, []);

  const savePreset = async (p: typeof PRESETS[number]) => {
    const cfg: any = (p.defaults ? { ...p.defaults } : {});
    const input = prompt(`Cole sua chave para ${p.name}:`);
    if (!input) return;
    cfg.api_key = input;
    if (p.id === "github") { cfg.token = input; delete cfg.api_key; }
    if (p.id === "vercel" || p.id === "mercadopago" || p.id === "netlify" || p.id === "figma") { cfg.token = input; delete cfg.api_key; }
    if (p.id === "stripe" || p.id === "resend") { cfg.secret = input; delete cfg.api_key; }
    const model = prompt("Modelo (opcional)", cfg.model || "");
    if (model) cfg.model = model;
    await fetch("/api/keys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider: p.id, kind: p.kind, config: cfg }) });
    setState([...((state as any[]) || [])]);
    await load();
  };

  const saveCustom = async () => {
    const minOk = draft.base_url && draft.model && draft.request_template && draft.response_path;
    if (!minOk) return alert("Preencha base_url, model, request_template e response_path.");
    await fetch("/api/keys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider: draft.provider, kind: "custom", config: draft }) });
    setDraft({ ...draft, api_key: "" });
    await load();
  };

  const test = async (provider: string) => {
    const r = await fetch("/api/keys?action=test", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider }) });
    const j = await r.json();
    alert(j.ok ? `✅ OK (HTTP ${j.http})` : `❌ HTTP ${j.http}: ${(j.msg || "").slice(0, 200)}`);
  };

  const del = async (provider: string) => {
    await fetch(`/api/keys?provider=${provider}`, { method: "DELETE" });
    await load();
  };

  const connected = useMemo(() => Object.fromEntries((state as any[]).map((r: any) => [r.provider, r])), [state]);

  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-8"><Link href="/dashboard" className="text-xl font-bold">← GangstarRemote</Link></header>
      <h1 className="text-3xl font-bold mb-2">Integrações</h1>
      <p className="text-muted text-sm mb-6">Suporta <b>qualquer API de IA</b>: presets prontos (OpenAI, Claude, Gemini, OpenRouter, DeepSeek, Groq, Mistral, Grok, Cohere…) <b>e provedores totalmente customizados</b> (URL, esquema de auth, modelo, mapeamento de request/response). Chaves criptografadas AES-256-GCM no servidor.</p>

      <div className="flex gap-2 mb-6 text-sm">
        <button onClick={() => setTab("preset")} className={`rounded-btn px-4 py-2 ${tab === "preset" ? "btn-grad" : "glass"}`}>Presets</button>
        <button onClick={() => setTab("custom")} className={`rounded-btn px-4 py-2 ${tab === "custom" ? "btn-grad" : "glass"}`}>🛠 Provedor Custom</button>
      </div>

      {tab === "preset" && (
        <div className="grid md:grid-cols-2 gap-4">
          {PRESETS.map(p => {
            const c = connected[p.id];
            return (
              <div key={p.id} className="glass rounded-card p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{p.icon} {p.name}</div>
                  {c ? <span className="text-xs text-green-400 bg-green-400/10 rounded-full px-2 py-0.5">conectado</span> : <span className="text-xs text-muted">desconectado</span>}
                </div>
                <p className="text-sm text-muted">{p.description}</p>
                {c && <p className="text-xs text-muted">modelo: <span className="font-mono">{c.config?.model || "—"}</span> · base_url: <span className="font-mono">{(c.config?.base_url || "").slice(0, 60)}…</span></p>}
                <div className="flex gap-2 mt-1">
                  {c ? <>
                    <button onClick={() => test(p.id)} className="glass rounded-btn px-3 py-1.5 text-sm">Testar</button>
                    <button onClick={() => del(p.id)} className="glass rounded-btn px-3 py-1.5 text-sm text-red-400">Desconectar</button>
                  </> : <button onClick={() => savePreset(p)} className="btn-grad glow rounded-btn px-4 py-1.5 text-sm font-semibold">Conectar</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "custom" && (
        <div className="glass rounded-card p-6 space-y-4">
          <p className="text-sm text-muted">Configure qualquer API HTTP. Placeholders suportados no template: <code>{'${model}'}</code>, <code>{'${messages}'}</code>, <code>{'${prompt}'}</code>, <code>{'${api_key}'}</code> (em headers).</p>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Nome do provedor" v={draft.provider} onChange={v => setDraft({ ...draft, provider: v })} placeholder="meu-provedor"/>
            <Field label="Modelo" v={draft.model} onChange={v => setDraft({ ...draft, model: v })} placeholder="modelo-x"/>
            <Field label="Base URL (POST)" v={draft.base_url} onChange={v => setDraft({ ...draft, base_url: v })} placeholder="https://api..." className="md:col-span-2"/>
            <Field label="Header de autenticação" v={draft.auth_header} onChange={v => setDraft({ ...draft, auth_header: v })} placeholder="Authorization"/>
            <Field label="Prefixo (ex: 'Bearer ')" v={draft.auth_prefix} onChange={v => setDraft({ ...draft, auth_prefix: v })} placeholder="Bearer "/>
            <Field label="JSON Path do delta (token streaming)" v={draft.response_path} onChange={v => setDraft({ ...draft, response_path: v })} placeholder="choices[0].delta.content"/>
            <Field label="Chave de API" v={draft.api_key} onChange={v => setDraft({ ...draft, api_key: v })} placeholder="sk-..." type="password"/>
          </div>
          <label className="block text-sm">Template do corpo (JSON, com placeholders <code>{'${...}'}</code>):</label>
          <textarea
            value={JSON.stringify(draft.request_template, null, 2)}
            onChange={e => { try { setDraft({ ...draft, request_template: JSON.parse(e.target.value) }); } catch {} }}
            rows={9}
            className="glow w-full bg-surface/60 border border-border1 rounded-input p-3 font-mono text-xs outline-none"
          />
          <label className="block text-sm">Headers extras (JSON):</label>
          <textarea
            value={JSON.stringify(draft.headers, null, 2)}
            onChange={e => { try { setDraft({ ...draft, headers: JSON.parse(e.target.value) }); } catch {} }}
            rows={3}
            className="glow w-full bg-surface/60 border border-border1 rounded-input p-3 font-mono text-xs outline-none"
          />
          <div className="flex gap-2">
            <button onClick={saveCustom} className="btn-grad glow rounded-btn px-5 py-2 font-semibold">Salvar provedor custom 🛠</button>
            {connected[draft.provider] && <button onClick={() => test(draft.provider)} className="glass rounded-btn px-4 py-2">Testar</button>}
          </div>
        </div>
      )}
    </main>
  );
}

function Field({ label, v, onChange, placeholder, type = "text", className = "" }: { label: string; v: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs text-muted mb-1">{label}</span>
      <input type={type} value={v} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder}
        className="glow w-full bg-transparent border border-border1 rounded-input px-3 py-2 text-sm outline-none" />
    </label>
  );
}
