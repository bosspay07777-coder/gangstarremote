import { createClient } from "@/lib/supabase/server";
import { streamLLM, MODELS, type Provider, type Msg } from "@/lib/llm";
import { SYSTEM, parseActions } from "@/lib/agent";
import { decrypt } from "@/lib/crypto";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  const { projectId, message, mode, provider: provIn, model } = await req.json();
  const { data: proj } = await sb.from("projects").select("*").eq("id", projectId).eq("user_id", user.id).single();
  if (!proj) return new Response("not found", { status: 404 });

  // resolve provider/key: BYOK do usuário ou fallback de env
  let provider: Provider = provIn || "openai";
  let apiKey = "";
  const { data: integ } = await sb.from("integrations").select("config").eq("user_id", user.id).eq("provider", provider).single();
  if (integ?.config?.api_key) apiKey = decrypt(integ.config.api_key);
  else apiKey = ({ openai: process.env.OPENAI_API_KEY, anthropic: process.env.ANTHROPIC_API_KEY, gemini: process.env.GEMINI_API_KEY, openrouter: process.env.OPENROUTER_API_KEY } as any)[provider] || "";
  if (!apiKey) return new Response(`Configure uma chave para ${provider} em Configurações → Chaves de IA (BYOK).`, { status: 400 });

  await sb.from("messages").insert({ project_id: projectId, role: "user", content: message });
  const [{ data: files }, { data: history }, { data: mdRow }] = await Promise.all([
    sb.from("project_files").select("path,content").eq("project_id", projectId),
    sb.from("messages").select("role,content").eq("project_id", projectId).order("created_at", { ascending: false }).limit(20),
    sb.from("project_files").select("content").eq("project_id", projectId).eq("path", "PROJECT.md").single(),
  ]);
  const msgs: Msg[] = [
    { role: "system", content: SYSTEM(files || [], mdRow?.content || "") },
    ...((history || []) as any[]).reverse().map((m: any) => ({ role: (m.role === "assistant" ? "assistant" : "user") as Msg["role"], content: m.content })),
    { role: "user", content: mode === "plan" ? `[MODO PLANEJAR] Não emita ações ainda. Apresente um plano em checklist e aguarde aprovação.\n\n${message}` : message },
  ];

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (event: string, data: any) => ctrl.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        let full = "";
        for await (const delta of streamLLM(provider, apiKey, msgs)) { full += delta; send("delta", { text: delta }); }
        const { text, actions } = parseActions(full);
        // snapshot antes das mudanças (histórico/versions)
        const { data: snap } = await sb.from("project_files").select("path,content").eq("project_id", projectId);
        await sb.from("versions").insert({ project_id: projectId, label: message.slice(0, 60), snapshot: snap || [] });
        const executed: any[] = [];
        for (const a of actions) {
          if (a.type === "write" && a.content !== undefined) {
            await sb.from("project_files").upsert({ project_id: projectId, path: a.path, content: a.content }, { onConflict: "project_id,path" });
            executed.push({ type: "created", path: a.path });
            send("action", { type: "write", path: a.path });
          } else if (a.type === "delete") {
            await sb.from("project_files").delete().eq("project_id", projectId).eq("path", a.path);
            executed.push({ type: "deleted", path: a.path });
            send("action", { type: "delete", path: a.path });
          }
        }
        const clean = (text + "\n" + actions.map(a => `- ${a.type === "delete" ? "Apagou" : "Escreveu"} \`${a.path}\``).join("\n")).trim();
        await sb.from("messages").insert({ project_id: projectId, role: "assistant", content: clean, actions: executed });
        send("done", { actions: executed });
      } catch (e: any) {
        send("error", { message: String(e.message || e) });
      }
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" } });
}
