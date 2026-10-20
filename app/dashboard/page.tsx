"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getClient } from "@/lib/supabase/client";

export default function Dashboard() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await getClient().auth.getUser();
      if (!user) { location.href = "/auth/signin"; return; }
      const res = await fetch("/api/projects");
      const j = await res.json();
      setProjects(j.projects || []); setLoading(false);
    })();
  }, []);
  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-10">
        <Link href="/" className="text-xl font-bold">⚡ GangstarRemote</Link>
        <div className="flex gap-3 text-sm">
          <Link href="/new" className="glass rounded-btn px-4 py-2">Novo projeto</Link>
          <Link href="/integrations" className="glass rounded-btn px-4 py-2">Integrações</Link>
          <Link href="/settings" className="glass rounded-btn px-4 py-2">Configurações</Link>
        </div>
      </header>
      <h1 className="text-3xl font-bold mb-8">Meus projetos</h1>
      {loading ? <div className="grid md:grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="skeleton h-36" />)}</div> : (
        <div className="grid md:grid-cols-3 gap-4">
          {projects.map(p => (
            <Link key={p.id} href={`/project/${p.id}`} className="glass rounded-card p-6 hover:border-violet-400/50 transition group">
              <div className="text-lg font-semibold group-hover:text-violet-300">{p.name}</div>
              <p className="text-sm text-muted mt-1 line-clamp-2">{p.description}</p>
              <div className="text-xs text-muted mt-4 flex gap-3">
                <span>{p.template === "github" ? `🐙 ${p.github_repo}` : `🧩 ${p.template}`}</span>
                <span>{new Date(p.updated_at).toLocaleDateString("pt-BR")}</span>
              </div>
            </Link>
          ))}
          {!projects.length && <p className="text-muted">Nenhum projeto ainda. <Link href="/new" className="text-violet-400">Crie o primeiro →</Link></p>}
        </div>
      )}
    </main>
  );
}
