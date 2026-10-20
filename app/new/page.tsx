"use client";
import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TEMPLATES } from "@/lib/templates";
import JSZip from "jszip";

function Inner() {
  const r = useRouter();
  const sp = useSearchParams();
  const [prompt] = useState(sp.get("prompt") || "");
  const [tab, setTab] = useState(prompt ? "chat" : sp.get("mode") === "github" ? "github" : "templates");
  const [name, setName] = useState("");
  const [repos, setRepos] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [ghErr, setGhErr] = useState("");
  const [busy, setBusy] = useState(false);
  const zipRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (tab === "github") fetch("/api/github").then(x => x.json()).then(j => { if (j.error) setGhErr(j.error); else setRepos(j.repos || []); }); }, [tab]);

  const createFromChat = async () => {
    setBusy(true);
    const res = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name || prompt.slice(0, 40) || "Novo projeto", template: "blank", description: prompt }) });
    const j = await res.json();
    if (j.project) r.push(`/project/${j.project.id}?firstPrompt=${encodeURIComponent(prompt)}`);
    else setBusy(false);
  };
  const createFromTemplate = async (t: string) => {
    setBusy(true);
    const res = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: TEMPLATES[t].label, template: t }) });
    const j = await res.json();
    if (j.project) r.push(`/project/${j.project.id}`); else setBusy(false);
  };
  const importRepo = async (full: string, branch: string) => {
    setBusy(true);
    const res = await fetch("/api/github/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repo: full, branch }) });
    const j = await res.json();
    if (j.project) r.push(`/project/${j.project.id}`); else { setGhErr(j.error); setBusy(false); }
  };
  const uploadZip = async (file: File) => {
    setBusy(true);
    const zip = await JSZip.loadAsync(file);
    const files: { path: string; content: string }[] = [];
    const entries = Object.values(zip.files).filter(f => !f.dir && !/node_modules|\.git\//.test(f.name));
    for (const e of entries.slice(0, 300)) files.push({ path: e.name, content: await e.async("string") });
    const res = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: file.name.replace(/\.zip$/i, ""), template: "blank", files }) });
    const j = await res.json();
    if (j.project) r.push(`/project/${j.project.id}`); else setBusy(false);
  };
  const tabs = [["chat", "💬 Criar via Chat"], ["github", "🐙 Importar GitHub"], ["templates", "🧩 Templates"], ["zip", "📦 Upload ZIP"]];
  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Criar projeto</h1>
      <div className="flex flex-wrap gap-2 mb-8">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-btn px-5 py-2.5 text-sm transition ${tab === k ? "btn-grad font-semibold" : "glass"}`}>{label}</button>
        ))}
      </div>
      {tab === "chat" && (
        <div className="glass rounded-card p-6 space-y-4">
          {prompt && <p className="text-sm text-muted">Prompt: “{prompt}”</p>}
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do projeto (opcional)" className="glow w-full bg-transparent border border-border1 rounded-input px-4 py-3 outline-none" />
          <button onClick={createFromChat} disabled={busy || !prompt} className="btn-grad glow rounded-btn px-6 py-3 font-semibold disabled:opacity-40">{busy ? "Criando…" : "Criar com o agente ⚡"}</button>
        </div>
      )}
      {tab === "github" && (
        <div className="space-y-4">
          {ghErr && <div className="glass rounded-card p-4 text-sm text-amber-300">{ghErr} — <a className="text-violet-400 underline" href="/integrations">conectar GitHub</a></div>}
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar repositório…" className="glow w-full bg-transparent border border-border1 rounded-input px-4 py-3 outline-none" />
          <div className="grid md:grid-cols-2 gap-3">
            {repos.filter(x => x.full_name.toLowerCase().includes(q.toLowerCase())).map(x => (
              <button key={x.full_name} disabled={busy} onClick={() => importRepo(x.full_name, x.default_branch)} className="glass rounded-card p-4 text-left hover:border-violet-400/50 transition disabled:opacity-50">
                <div className="font-medium">{x.full_name} {x.private ? "🔒" : ""}</div>
                <div className="text-xs text-muted mt-1">branch: {x.default_branch} · {x.description || "sem descrição"}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      {tab === "templates" && (
        <div className="grid md:grid-cols-3 gap-4">
          {Object.entries(TEMPLATES).map(([k, t]) => (
            <button key={k} disabled={busy} onClick={() => createFromTemplate(k)} className="glass rounded-card p-6 text-left hover:border-violet-400/50 transition">
              <div className="text-3xl mb-2">{t.icon}</div>
              <div className="font-semibold">{t.label}</div>
              <div className="text-sm text-muted">{t.desc}</div>
            </button>
          ))}
        </div>
      )}
      {tab === "zip" && (
        <div className="glass rounded-card p-6">
          <input ref={zipRef} type="file" accept=".zip" className="hidden" onChange={e => e.target.files?.[0] && uploadZip(e.target.files[0])} />
          <button onClick={() => zipRef.current?.click()} disabled={busy} className="btn-grad glow rounded-btn px-6 py-3 font-semibold disabled:opacity-40">{busy ? "Processando…" : "Escolher arquivo .zip"}</button>
          <p className="text-sm text-muted mt-3">Máx. 300 arquivos, sem node_modules/.git.</p>
        </div>
      )}
    </main>
  );
}
export default function NewPage() { return <Suspense><Inner /></Suspense>; }
