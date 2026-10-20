"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getClient } from "@/lib/supabase/client";
import dynamic from "next/dynamic";
const Monaco = dynamic(() => import("@monaco-editor/react"), { loading: () => <div className="skeleton h-full" /> });

type File = { id?: string; path: string; content: string };
type Msg = { id?: string; role: "user" | "assistant"; content: string; actions?: any[] };

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const [name, setName] = useState("");
  const [proj, setProj] = useState<any>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [active, setActive] = useState("index.html");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<"exec" | "plan">("exec");
  const [tab, setTab] = useState<"preview" | "code" | "db" | "logs" | "hist">("preview");
  const [previewUrl, setPreviewUrl] = useState("");
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [logs, setLogs] = useState<string[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [sql, setSql] = useState("select * from projects limit 5");
  const [sqlRes, setSqlRes] = useState("");
  const [ghRepo, setGhRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const esRef = useRef<EventSource | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);

  const log = (s: string) => setLogs(l => [...l.slice(-200), `[${new Date().toLocaleTimeString("pt-BR")}] ${s}`]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) { location.href = "/dashboard"; return; }
    const j = await res.json();
    setProj(j.project); setName(j.project.name); setFiles(j.files || []); setMessages(j.messages || []); setVersions(j.versions || []);
    setGhRepo(j.project.github_repo || ""); setBranch(j.project.github_branch || "main");
    if (!j.files?.some((f: File) => f.path === "index.html") && j.files?.length) setActive(j.files[0].path);
    log("Projeto carregado (" + (j.files?.length || 0) + " arquivos)");
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streaming]);

  const saveFile = async (path: string, content: string) => {
    setSaveState("saving");
    setFiles(f => f.map(x => x.path === path ? { ...x, content } : x));
    await fetch(`/api/projects/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "write", path, content }) });
    setSaveState("saved"); setPreviewUrl(`/api/preview/${id}?t=${Date.now()}`); log(`Arquivo salvo: ${path}`);
  };

  const buildPreview = (fls: File[]) => {
    // monta preview em blob: injeta CSS/JS relativos
    const idx = fls.find(f => f.path === "index.html");
    if (!idx) return "";
    let html = idx.content;
    html = html.replace(/<link[^>]+href=["']([^"']+\.css)["'][^>]*>/g, (m, href) => {
      const f = fls.find(x => x.path.replace(/^\.\//, "") === href.replace(/^\.\//, ""));
      return f ? `<style>${f.content}</style>` : m;
    });
    html = html.replace(/<script[^>]+src=["']([^"']+\.js)["'][^>]*>\s*<\/script>/g, (m, src) => {
      const f = fls.find(x => x.path.replace(/^\.\//, "") === src.replace(/^\.\//, ""));
      return f ? `<script>${f.content}</script>` : m;
    });
    return html;
  };
  const [previewHtml, setPreviewHtml] = useState("");
  useEffect(() => { setPreviewHtml(buildPreview(files)); }, [files]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || running) return;
    setInput(""); setRunning(true); setStreaming("");
    setMessages(m => [...m, { role: "user", content: msg }]);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: id, message: msg, mode }) });
      if (!res.ok) { const t = await res.text(); setMessages(m => [...m, { role: "assistant", content: "⚠️ " + t }]); setRunning(false); return; }
      const reader = res.body!.getReader(); const dec = new TextDecoder(); let buf = "", acc = "";
      let cur = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n"); buf = parts.pop() || "";
        for (const part of parts) {
          const [evLine, ...rest] = part.split("\n");
          const ev = evLine.replace("event: ", "").trim();
          const data = JSON.parse(rest.join("\n").replace("data: ", ""));
          if (ev === "delta") { cur += data.text; setStreaming(cur); }
          else if (ev === "action") log(`🔧 ${data.type === "delete" ? "Apagou" : "Escreveu"} ${data.path}`);
          else if (ev === "done") { await load(); }
          else if (ev === "error") { setMessages(m => [...m, { role: "assistant", content: "⚠️ " + data.message }]); }
        }
      }
      setMessages(m => [...m, { role: "assistant", content: cur || "(sem resposta)" }]);
      log("Agente concluiu o ciclo.");
    } catch (e: any) {
      setMessages(m => [...m, { role: "assistant", content: "⚠️ " + (e.message || "erro de rede") }]);
    }
    setStreaming(""); setRunning(false);
  };

  const stop = () => { esRef.current?.close(); setRunning(false); setStreaming(""); log("Execução interrompida pelo usuário."); };

  const runSql = async () => {
    setSqlRes("Executando…");
    const res = await fetch("/api/supabase", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ref: proj?.supabase_ref, sql }) });
    const j = await res.json();
    setSqlRes(j.destructive_hint ? "⚠️ " + j.destructive_hint + "\n\n" + JSON.stringify(j.result, null, 2) : JSON.stringify(j.result, null, 2));
    log("SQL executado no Supabase " + (proj?.supabase_ref || "(não vinculado)"));
  };

  const commit = async () => {
    if (!ghRepo) return alert("Vincule um repositório primeiro.");
    log("Fazendo commit e push…");
    const res = await fetch("/api/github", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: id, repo: ghRepo, branch, commitMessage: `feat: atualização via GangstarRemote — ${new Date().toLocaleString("pt-BR")}` }) });
    const j = await res.json();
    log(j.ok ? `✅ Commit pushed: ${j.url}` : "❌ " + j.error);
  };

  const publish = async () => {
    log("Publicando na Vercel…");
    const res = await fetch("/api/deploy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId: id }) });
    const j = await res.json();
    log(j.ok ? `🚀 Deploy: ${j.url}` : "❌ " + j.error);
  };

  const restore = async (v: any) => {
    await fetch(`/api/projects/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "restore", snapshot: v.snapshot }) });
    // aplica snapshot
    for (const f of v.snapshot) await fetch(`/api/projects/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "write", path: f.path, content: f.content }) });
    await load(); log(`↩️ Versão restaurada: ${v.label}`);
  };

  const width = device === "desktop" ? "100%" : device === "tablet" ? "768px" : "390px";
  const openFiles = [...new Set(files.map(f => f.path))];

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Topbar */}
      <header className="glass flex items-center gap-3 px-4 py-2.5 border-b border-border1/50 z-10">
        <a href="/dashboard" className="text-lg">←</a>
        <input value={name} onChange={e => setName(e.target.value)} onBlur={async () => { await fetch(`/api/projects/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) }); }}
          className="bg-transparent font-semibold rounded-input px-2 py-1 outline-none glow focus:bg-surface/60 min-w-0 w-48" />
        <span className={`text-xs px-2 py-0.5 rounded-full ${saveState === "saved" ? "text-green-400 bg-green-400/10" : "text-amber-300 bg-amber-400/10"}`}>{saveState === "saved" ? "✓ sincronizado" : "salvando…"}</span>
        <div className="flex-1" />
        <button onClick={commit} className="glass rounded-btn px-3 py-1.5 text-sm hover:border-violet-400/50 transition">🐙 Commit</button>
        <button onClick={() => setTab("db")} className="glass rounded-btn px-3 py-1.5 text-sm hover:border-violet-400/50 transition">🟢 Supabase</button>
        <button onClick={publish} className="btn-grad glow rounded-btn px-4 py-1.5 text-sm font-semibold">Publicar</button>
      </header>

      <div className="flex-1 flex min-h-0 flex-col md:flex-row">
        {/* Chat */}
        <aside className="md:w-[30%] w-full h-[45%] md:h-auto flex flex-col glass md:border-r border-border1/50">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border1/40 text-sm">
            <button onClick={() => setMode("exec")} className={`rounded-btn px-3 py-1 ${mode === "exec" ? "btn-grad" : "glass"}`}>Executar</button>
            <button onClick={() => setMode("plan")} className={`rounded-btn px-3 py-1 ${mode === "plan" ? "btn-grad" : "glass"}`}>Planejar</button>
            <div className="flex-1" />
            {running && <button onClick={stop} className="text-red-400 text-xs glass rounded-btn px-3 py-1">■ Parar</button>}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[92%] rounded-card px-4 py-3 text-sm whitespace-pre-wrap ${m.role === "user" ? "ml-auto btn-grad" : "glass"}`}>{m.content}</div>
            ))}
            {streaming && (
              <div className="glass rounded-card px-4 py-3 text-sm max-w-[92%] whitespace-pre-wrap">
                {streaming.replace(/<action[\s\S]*?<\/action>/g, "▌escrevendo arquivo…\n")}
                <span className="inline-block w-2 h-4 bg-violet-400 animate-pulse ml-1" />
              </div>
            )}
            {running && !streaming && <div className="glass rounded-card px-4 py-3 text-sm text-muted flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-violet-400 animate-ping" /> agente pensando…</div>}
            <div ref={chatEnd} />
          </div>
          <div className="p-3 border-t border-border1/40 flex gap-2">
            <textarea value={input} rows={2} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={mode === "plan" ? "Descreva o que quer — o agente planeja antes" : "Peça alterações ao agente…"}
              className="glow flex-1 bg-surface/60 border border-border1 rounded-input px-3 py-2 text-sm outline-none resize-none" />
            <button onClick={() => send()} disabled={running || !input.trim()} className="btn-grad glow rounded-btn px-4 font-semibold disabled:opacity-40">➤</button>
          </div>
        </aside>

        {/* Right panel */}
        <section className="flex-1 flex flex-col min-h-0">
          <nav className="flex gap-1 px-3 py-2 border-b border-border1/40 overflow-x-auto text-sm">
            {([["preview", "👁 Preview"], ["code", "⌨ Código"], ["db", "🗄 Banco de Dados"], ["logs", "📋 Logs"], ["hist", "🕘 Histórico"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`rounded-btn px-4 py-1.5 whitespace-nowrap ${tab === k ? "btn-grad" : "glass"}`}>{label}</button>
            ))}
          </nav>
          {tab === "preview" && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center gap-2 px-3 py-2 text-sm">
                {([["desktop", "🖥"], ["tablet", "📱"], ["mobile", "📲"]] as const).map(([k, ic]) => (
                  <button key={k} onClick={() => setDevice(k)} className={`rounded-btn px-3 py-1 ${device === k ? "btn-grad" : "glass"}`}>{ic}</button>
                ))}
                <button onClick={() => setPreviewHtml(buildPreview(files))} className="glass rounded-btn px-3 py-1">↻</button>
                <div className="flex-1" />
                {ghRepo && <a href={`https://github.com/${ghRepo}`} target="_blank" className="glass rounded-btn px-3 py-1">Abrir repo ↗</a>}
              </div>
              <div className="flex-1 flex justify-center bg-black/30 p-2 overflow-auto">
                <iframe title="preview" srcDoc={previewHtml} style={{ width, maxWidth: "100%" }} className="h-full rounded-panel bg-white border border-border1/60" sandbox="allow-scripts allow-forms allow-popups" />
              </div>
            </div>
          )}
          {tab === "code" && (
            <div className="flex-1 flex min-h-0">
              <div className="w-56 border-r border-border1/40 overflow-y-auto p-2 text-sm">
                {openFiles.map(p => (
                  <div key={p} className={`group flex items-center justify-between rounded-input px-2 py-1 cursor-pointer ${active === p ? "bg-violet-500/20" : "hover:bg-surface/60"}`} onClick={() => setActive(p)}>
                    <span className="truncate font-mono text-xs">{p}</span>
                    <button className="opacity-0 group-hover:opacity-100 text-red-400 px-1" onClick={async e => { e.stopPropagation(); await fetch(`/api/projects/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "delete", path: p }) }); setFiles(f => f.filter(x => x.path !== p)); }}>×</button>
                  </div>
                ))}
                <button className="mt-2 glass rounded-btn w-full py-1.5 text-xs" onClick={async () => {
                  const path = prompt("Caminho do novo arquivo:", "novo.html"); if (!path) return;
                  await fetch(`/api/projects/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op: "write", path, content: "" }) });
                  await load(); setActive(path);
                }}>+ novo arquivo</button>
              </div>
              <div className="flex-1 min-h-0">
                <Monaco
                  key={active} theme="vs-dark" language={active.endsWith(".html") ? "html" : active.endsWith(".css") ? "css" : active.endsWith(".json") ? "json" : "javascript"}
                  value={files.find(f => f.path === active)?.content || ""}
                  onChange={v => saveFile(active, v ?? "")}
                  options={{ fontFamily: "JetBrains Mono", fontSize: 13, minimap: { enabled: false }, automaticLayout: true, tabSize: 2 }}
                />
              </div>
            </div>
          )}
          {tab === "db" && (
            <div className="flex-1 p-4 flex flex-col gap-3 min-h-0">
              <div className="glass rounded-card p-4 text-sm">
                <b>Supabase vinculado:</b> {proj?.supabase_ref ? `✅ ${proj.supabase_ref}` : "❌ nenhum"}
                <div className="flex gap-2 mt-2">
                  <input id="sbref" placeholder="ref do projeto (ex: jsayxaddlimkhifokzkc)" className="glow flex-1 bg-transparent border border-border1 rounded-input px-3 py-1.5 outline-none font-mono text-xs" />
                  <button className="glass rounded-btn px-3 py-1.5" onClick={async () => {
                    const ref = (document.getElementById("sbref") as HTMLInputElement).value.trim();
                    await fetch(`/api/projects/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ supabase_ref: ref }) });
                    await load();
                  }}>Vincular</button>
                </div>
              </div>
              <textarea value={sql} onChange={e => setSql(e.target.value)} rows={5} className="glow w-full bg-surface/60 border border-border1 rounded-input px-4 py-3 font-mono text-sm outline-none" />
              <button onClick={runSql} className="btn-grad glow rounded-btn px-5 py-2 font-semibold self-start">Executar SQL</button>
              <pre className="glass rounded-card p-4 text-xs font-mono overflow-auto flex-1">{sqlRes || "Resultado aparecerá aqui."}</pre>
            </div>
          )}
          {tab === "logs" && (
            <div className="flex-1 p-4 overflow-auto">
              <pre className="glass rounded-card p-4 text-xs font-mono whitespace-pre-wrap h-full">{logs.join("\n") || "Sem logs ainda."}</pre>
            </div>
          )}
          {tab === "hist" && (
            <div className="flex-1 p-4 space-y-2 overflow-auto">
              {versions.map(v => (
                <div key={v.id} className="glass rounded-card p-4 flex items-center justify-between">
                  <div><div className="text-sm">{v.label || "sem descrição"}</div><div className="text-xs text-muted">{new Date(v.created_at).toLocaleString("pt-BR")}</div></div>
                  <button onClick={() => restore(v)} className="glass rounded-btn px-3 py-1.5 text-sm hover:border-violet-400/50">↩ Restaurar</button>
                </div>
              ))}
              {!versions.length && <p className="text-muted text-sm">Versões aparecerão após a primeira edição do agente.</p>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
