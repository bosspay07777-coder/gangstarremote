export type Msg = { role: "system" | "user" | "assistant"; content: string };
export type ProviderKind = "openai" | "anthropic" | "gemini" | "openrouter" | "custom";

export type ProviderConfig = {
  kind: ProviderKind;
  model: string;
  // only for custom
  base_url?: string;
  auth_header?: string;
  auth_prefix?: string;
  headers?: Record<string, string>;
  request_template?: any; // json object with placeholders ${model} ${messages} ${prompt}
  response_path?: string; // e.g. "choices[0].delta.content"
  stream?: boolean;
};

export const PRESETS: Record<Exclude<ProviderKind, "custom">, { label: string; icon: string; model: string; base_url?: string; auth_prefix: string; auth_header: string; kind: ProviderKind; description: string }> = {
  openai: { kind: "openai", label: "OpenAI", icon: "🤖", model: "gpt-4o", base_url: "https://api.openai.com/v1/chat/completions", auth_header: "Authorization", auth_prefix: "Bearer ", description: "GPT-4o, GPT-4 Turbo, o1 etc." },
  anthropic: { kind: "anthropic", label: "Anthropic (Claude)", icon: "🧠", model: "claude-sonnet-4-20250514", base_url: "https://api.anthropic.com/v1/messages", auth_header: "x-api-key", auth_prefix: "", description: "Claude Sonnet, Opus, Haiku" },
  gemini: { kind: "gemini", label: "Google Gemini", icon: "✨", model: "gemini-2.0-flash", base_url: "https://generativelanguage.googleapis.com/v1beta/models/", auth_header: "x-goog-api-key", auth_prefix: "", description: "Gemini Flash, Pro" },
  openrouter: { kind: "openrouter", label: "OpenRouter", icon: "🌐", model: "openai/gpt-4o", base_url: "https://openrouter.ai/api/v1/chat/completions", auth_header: "Authorization", auth_prefix: "Bearer ", description: "Roteia entre 200+ modelos" },
};

function applyTemplate(tpl: any, ctx: Record<string, any>): any {
  if (typeof tpl === "string") return tpl.replace(/\$\{(\w+)\}/g, (_, k) => JSON.stringify(ctx[k] ?? ""));
  if (Array.isArray(tpl)) return tpl.map(v => applyTemplate(v, ctx));
  if (tpl && typeof tpl === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(tpl)) out[k] = applyTemplate(v, ctx);
    return out;
  }
  return tpl;
}

export function jsonPath(obj: any, path: string): any {
  if (!path) return undefined;
  const tokens = path.match(/[^.[\]]+/g) || [];
  let cur = obj;
  for (const t of tokens) {
    if (cur == null) return undefined;
    cur = cur[t];
  }
  return cur;
}

function msgsToOpenAI(messages: Msg[]) { return messages.map(m => ({ role: m.role === "system" ? "system" : m.role, content: m.content })); }
function msgsToGemini(messages: Msg[]) {
  const sys = messages.find(m => m.role === "system")?.content;
  const contents = messages.filter(m => m.role !== "system").map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  return { contents, systemInstruction: sys ? { parts: [{ text: sys }] } : undefined };
}
function msgsToAnthropic(messages: Msg[]) {
  const sys = messages.filter(m => m.role === "system").map(m => m.content).join("\n");
  return { system: sys || undefined, messages: messages.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content })) };
}

export async function* streamLLM(provider: ProviderConfig, apiKey: string, messages: Msg[]): AsyncGenerator<string> {
  let url = "", headers: Record<string, string> = { "content-type": "application/json" }, body: any;

  if (provider.kind === "anthropic") {
    url = PRESETS.anthropic.base_url!;
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    const ad = msgsToAnthropic(messages);
    body = { model: provider.model, max_tokens: 8192, stream: true, ...ad };
  } else if (provider.kind === "gemini") {
    const base = PRESETS.gemini.base_url!;
    url = `${base}${provider.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
    body = msgsToGemini(messages);
  } else if (provider.kind === "openai" || provider.kind === "openrouter") {
    url = provider.kind === "openrouter" ? PRESETS.openrouter.base_url! : (provider.base_url || PRESETS.openai.base_url!);
    headers["authorization"] = `Bearer ${apiKey}`;
    if (provider.kind === "openrouter") headers["HTTP-Referer"] = "https://gangstarremote.app";
    body = { model: provider.model, stream: true, messages: msgsToOpenAI(messages) };
  } else {
    // custom
    if (!provider.base_url || !provider.request_template || !provider.response_path) throw new Error("Provedor custom: preencha base_url, request_template e response_path.");
    url = provider.base_url;
    const preface = `${provider.auth_prefix ?? ""}${apiKey}`;
    if (provider.auth_header) headers[provider.auth_header] = provider.auth_prefix ? `${provider.auth_prefix}${apiKey}` : apiKey;
    Object.entries(provider.headers || {}).forEach(([k, v]) => { headers[k] = String(v).replace(/\$\{api_key\}/g, apiKey); });
    const ctx = { model: provider.model, messages: msgsToOpenAI(messages), prompt: messages[messages.length - 1]?.content || "" };
    body = applyTemplate(provider.request_template, ctx);
  }

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok || !res.body) throw new Error(`LLM ${provider.kind} erro ${res.status}: ${(await res.text()).slice(0, 300)}`);

  // Para Gemini via x-goog-api-key, body já tem o stream embutido; mas usamos mesma leitura SSE
  const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    if (provider.kind === "anthropic") {
      // eventos SSE nomeados
      for (const line of buf.split("\n")) {
        const t = line.trim();
        if (t.startsWith("data:")) {
          const payload = t.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try { const j = JSON.parse(payload); const ev = j.type; if (ev === "content_block_delta") { const d = j.delta?.text; if (d) yield d; } } catch {}
        }
      }
      buf = buf.slice(buf.lastIndexOf("\n") + 1);
      continue;
    }
    // SSE / data: blocks
    for (const line of buf.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim(); if (payload === "[DONE]") return;
      try {
        const j = JSON.parse(payload);
        const delta = jsonPath(j, provider.response_path || (provider.kind === "gemini" ? "candidates[0].content.parts[0].text" : "choices[0].delta.content"));
        if (typeof delta === "string" && delta) yield delta;
      } catch {}
    }
    buf = buf.slice(buf.lastIndexOf("\n") + 1);
  }
}

export async function completeLLM(provider: ProviderConfig, apiKey: string, messages: Msg[]) {
  let out = ""; for await (const c of streamLLM(provider, apiKey, messages)) out += c; return out;
}

// Testa conexão em modo NÃO-stream.
export async function testProvider(p: ProviderConfig, apiKey: string): Promise<{ ok: boolean; http: number; msg: string }> {
  try {
    let url: string, headers: Record<string, string> = {}, body: any;
    if (p.kind === "anthropic") {
      url = PRESETS.anthropic.base_url!; headers["x-api-key"] = apiKey; headers["anthropic-version"] = "2023-06-01";
      body = { model: p.model, max_tokens: 8, messages: [{ role: "user", content: "ping" }] };
    } else if (p.kind === "gemini") {
      url = `${PRESETS.gemini.base_url!}${p.model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      body = { contents: [{ role: "user", parts: [{ text: "ping" }] }] };
    } else if (p.kind === "openai" || p.kind === "openrouter") {
      url = p.kind === "openrouter" ? PRESETS.openrouter.base_url! : PRESETS.openai.base_url!;
      headers["authorization"] = `Bearer ${apiKey}`;
      body = { model: p.model, messages: [{ role: "user", content: "ping" }], max_tokens: 8 };
    } else {
      url = p.base_url || "";
      if (p.auth_header) headers[p.auth_header] = (p.auth_prefix || "") + apiKey;
      Object.entries(p.headers || {}).forEach(([k, v]) => { headers[k] = String(v).replace(/\$\{api_key\}/g, apiKey); });
      const ctx = { model: p.model, messages: [{ role: "user", content: "ping" }] };
      body = applyTemplate(p.request_template || {}, ctx);
    }
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const txt = (await r.text()).slice(0, 300);
    return { ok: r.ok, http: r.status, msg: txt };
  } catch (e: any) { return { ok: false, http: 0, msg: String(e.message || e) }; }
}
