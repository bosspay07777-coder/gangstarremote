import { createClient } from "@/lib/supabase/server";
import { streamLLM, type ProviderConfig } from "@/lib/llm";
import { SYSTEM, parseActions } from "@/lib/agent";
import { decrypt } from "@/lib/crypto";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  const { projectId, message, mode, provider } = await req.json();

  const { data: proj } = await sb.from("projects").select("*").eq("id", projectId).eq("user_id", user.id).single();
  if (!proj) return new Response("not found", { status: 404 });

  // Resolve provedor: explícito do cliente ou o primeiro conectado
  let integ = null as any;
  if (provider) {
    integ = (await sb.from("integrations").select("config,kind,provider").eq("user_id", user.id).eq("provider", provider).single()).data;
  }
  if (!integ) {
    // CABEÇA PRINCIPAL: TokenHarbor primeiro quando conectado
    integ = (await sb.from("integrations").select("config,kind,provider").eq("user_id", user.id).eq("provider", "tokenharbor").single()).data;
  }
  if (!integ) {
    integ = (await sb.from("integrations").select("config,kind,provider").eq("user_id", user.id).in("kind", ["tokenharbor", "openai", "anthropic", "gemini", "openrouter", "custom"]).limit(1).single()).data;
  }
  if (!integ && process.env.TOKENHARBOR_API_KEY) {
    // Fallback da plataforma: chave TokenHarbor do ambiente
    integ = { provider: "tokenharbor", kind: "tokenharbor", config: { api_key: process.env.TOKENHARBOR_API_KEY } };
  }
  if (!integ) return new Response("Nenhum provedor de IA configurado. Vá em /integrations e conecte ao menos um.", { status: 400 });

  // Decrypt tolerante: se o valor já estiver em claro (ex.: fallback do env), mantém
  const safeDecrypt = (s: string) => { try { return decrypt(s); } catch { return s; } };
  const cfg: any = {}; for (const [k, v] of Object.entries(integ.config || {})) cfg[k] = safeDecrypt(String(v));
  const p: ProviderConfig = { ...cfg, kind: integ.kind || "custom" };
  const apiKey = cfg.api_key || cfg.token || cfg.secret || (cfg.key) || "";

  await sb.from("messages").insert({ project_id: projectId, role: "user", content: message });
  const [{ data: files }, { data: history }, { data: mdRow }] = await Promise.all([
    sb.from("project_files").select("path,content").eq("project_id", projectId),
    sb.from("messages").select("role,content").eq("project_id", projectId).order("created_at", { ascending: false }).limit(20),
    sb.from("project_files").select("content").eq("project_id", projectId).eq("path", "PROJECT.md").single(),
  ]);
  const msgs = [
    { role: "system" as const, content: SYSTEM(files || [], mdRow?.content || "") },
    ...((history || []) as any[]).reverse().map((m: any) => ({ role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user", content: m.content })),
    { role: "user" as const, content: mode === "plan" ? `[MODO PLANEJAR] Não emita ações ainda. Apresente um plano em checklist e aguarde aprovação.\n\n${message}` : message },
  ];

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (event: string, data: any) => ctrl.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        let full = "";
        for await (const delta of streamLLM(p, apiKey, msgs as any)) { full += delta; send("delta", { text: delta }); }
        const { text, actions } = parseActions(full);
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
        send("done", { actions: executed, provider: integ.provider, model: p.model });
      } catch (e: any) {
        send("error", { message: String(e.message || e) });
      }
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" } });
}
