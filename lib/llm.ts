export type Msg = { role: "system" | "user" | "assistant"; content: string };
export type Provider = "openai" | "anthropic" | "gemini" | "openrouter";
export const MODELS: Record<Provider, { label: string; model: string }> = {
  openai: { label: "GPT-4o", model: "gpt-4o" },
  anthropic: { label: "Claude Sonnet", model: "claude-sonnet-4-20250514" },
  gemini: { label: "Gemini Flash", model: "gemini-2.0-flash" },
  openrouter: { label: "OpenRouter (auto)", model: "openai/gpt-4o" },
};
export async function* streamLLM(provider: Provider, apiKey: string, messages: Msg[]) {
  let url = "", headers: Record<string, string> = { "content-type": "application/json" }, body: any;
  if (provider === "anthropic") {
    url = "https://api.anthropic.com/v1/messages"; headers["x-api-key"] = apiKey; headers["anthropic-version"] = "2023-06-01";
    const sys = messages.filter(m => m.role === "system").map(m => m.content).join("\n");
    body = { model: MODELS[provider].model, max_tokens: 8192, stream: true, system: sys || undefined, messages: messages.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content })) };
  } else if (provider === "gemini") {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS[provider].model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    body = { contents: messages.filter(m => m.role !== "system").map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })), systemInstruction: { parts: [{ text: (messages.find(m => m.role === "system")?.content || "") }] } };
  } else {
    url = provider === "openrouter" ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
    headers["authorization"] = `Bearer ${apiKey}`; if (provider === "openrouter") headers["HTTP-Referer"] = "https://gangstarremote.app";
    body = { model: MODELS[provider].model, stream: true, messages };
  }
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok || !res.body) throw new Error(`LLM ${provider} erro ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    for (const line of buf.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim(); if (payload === "[DONE]") return;
      try {
        const j = JSON.parse(payload);
        const delta = provider === "anthropic" ? (j.type === "content_block_delta" ? j.delta?.text : undefined)
          : provider === "gemini" ? j.candidates?.[0]?.content?.parts?.[0]?.text
          : j.choices?.[0]?.delta?.content;
        if (delta) yield delta as string;
      } catch {}
    }
    buf = buf.slice(buf.lastIndexOf("\n") + 1);
  }
}
export async function completeLLM(provider: Provider, apiKey: string, messages: Msg[]): Promise<string> {
  let out = ""; for await (const c of streamLLM(provider, apiKey, messages)) out += c; return out;
}
