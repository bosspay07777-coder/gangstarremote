"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getClient } from "@/lib/supabase/client";

export default function Settings() {
  const [email, setEmail] = useState("");
  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    getClient().auth.getUser().then(({ data }) => setEmail(data.user?.email || ""));
    setTheme(localStorage.theme || "dark");
  }, []);
  const toggle = () => {
    const t = theme === "dark" ? "light" : "dark";
    setTheme(t); localStorage.theme = t;
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.classList.toggle("light", t === "light");
  };
  const signout = async () => { await getClient().auth.signOut(); location.href = "/"; };
  return (
    <main className="min-h-screen p-8 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-8"><Link href="/dashboard" className="text-xl font-bold">← GangstarRemote</Link></header>
      <h1 className="text-3xl font-bold mb-8">Configurações</h1>
      <div className="glass rounded-card p-6 space-y-4">
        <div className="flex justify-between items-center"><span>Conta</span><span className="text-muted text-sm">{email || "—"}</span></div>
        <div className="flex justify-between items-center"><span>Tema</span><button onClick={toggle} className="glass rounded-btn px-4 py-1.5 text-sm">{theme === "dark" ? "🌙 Escuro" : "☀️ Claro"}</button></div>
        <div className="flex justify-between items-center"><span>Limites de uso</span><span className="text-green-400 text-sm">Ilimitado — sem paywall</span></div>
        <button onClick={signout} className="glass rounded-btn px-4 py-2 text-sm text-red-400">Sair</button>
      </div>
    </main>
  );
}
