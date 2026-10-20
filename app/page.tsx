"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { getClient } from "@/lib/supabase/client";

export default function Home() {
  const r = useRouter();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    const sb = getClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { localStorage.setItem("pendingPrompt", prompt); r.push("/login"); return; }
    r.push(`/new?prompt=${encodeURIComponent(prompt)}`);
  };
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:.5}} className="w-full max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-btn glass text-xs text-muted mb-8">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Agente autônomo online
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4">
          Construa apps <span className="text-transparent bg-clip-text btn-grad">conversando</span>
        </h1>
        <p className="text-muted text-lg mb-10">Descreva sua ideia. O agente planeja, escreve o código, roda o preview e publica.</p>
        <div className="glass rounded-card p-3 flex flex-col md:flex-row gap-3 shadow-2xl shadow-violet-500/10">
          <textarea
            value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); } }}
            placeholder="Ex: um CRM para barbearias com agendamento e cobrança PIX…"
            className="glow flex-1 bg-transparent rounded-input px-4 py-3 resize-none outline-none placeholder:text-muted/60"
          />
          <button onClick={go} disabled={busy || !prompt.trim()}
            className="btn-grad glow rounded-btn px-8 py-3 font-semibold disabled:opacity-40 transition">
            {busy ? "…" : "Criar ⚡"}
          </button>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mt-8 text-sm">
          <Link href="/new?mode=github" className="glass rounded-btn px-5 py-2.5 hover:border-violet-400/50 transition">🔗 Importar do GitHub</Link>
          <Link href="/new" className="glass rounded-btn px-5 py-2.5 hover:border-violet-400/50 transition">🧩 Templates</Link>
          <Link href="/dashboard" className="glass rounded-btn px-5 py-2.5 hover:border-violet-400/50 transition">📁 Meus projetos</Link>
        </div>
      </motion.div>
    </main>
  );
}
