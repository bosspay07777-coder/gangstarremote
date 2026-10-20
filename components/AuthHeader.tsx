"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { getClient } from "@/lib/supabase/client";

export default function AuthHeader() {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const r = useRouter();
  const path = usePathname();

  const refresh = async () => {
    const { data } = await getClient().auth.getUser();
    setEmail(data.user?.email ?? null);
    setReady(true);
  };

  useEffect(() => {
    refresh();
    const { data: sub } = getClient().auth.onAuthStateChange((_e, sess) => {
      setEmail(sess?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const logout = async () => {
    await getClient().auth.signOut();
    setEmail(null);
    setShowMenu(false);
    r.push("/");
    r.refresh();
  };

  // páginas que já mostram o próprio CTAs não precisam do header duplicado
  const hideLinksOn = new Set(["/login", "/cadastro"]);
  const minimal = hideLinksOn.has(path);

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-bg/60 border-b border-border1/60">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3 text-sm">
        <Link href="/" className="font-bold flex items-center gap-1.5">
          <span>⚡ GangstarRemote</span>
        </Link>
        {!minimal && (
          <nav className="hidden sm:flex items-center gap-1 ml-3">
            <Link href="/dashboard" className="text-muted hover:text-fg px-3 py-1.5 rounded-btn hover:bg-surface/60">Projetos</Link>
            <Link href="/integrations" className="text-muted hover:text-fg px-3 py-1.5 rounded-btn hover:bg-surface/60">Integrações</Link>
            <Link href="/settings" className="text-muted hover:text-fg px-3 py-1.5 rounded-btn hover:bg-surface/60">Configurações</Link>
          </nav>
        )}
        <div className="flex-1" />
        {!ready ? (
          <span className="text-muted text-xs">…</span>
        ) : email ? (
          <div className="relative">
            <button
              onClick={() => setShowMenu(s => !s)}
              className="glass rounded-btn px-3 py-1.5 flex items-center gap-2 hover:border-violet-400/50"
              aria-label="Menu da conta"
            >
              <span className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white text-xs font-semibold grid place-items-center">
                {email[0]?.toUpperCase()}
              </span>
              <span className="hidden sm:inline text-muted">{email.split("@")[0]}</span>
              <span className="text-muted text-xs">▾</span>
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-2 w-64 glass rounded-card p-2 shadow-2xl shadow-violet-500/10 z-50">
                <div className="px-3 py-2 text-xs text-muted break-all">{email}</div>
                <div className="h-px bg-border1 my-1" />
                <Link href="/dashboard" onClick={() => setShowMenu(false)} className="block px-3 py-2 rounded-input hover:bg-surface/80">📁 Meus projetos</Link>
                <Link href="/settings" onClick={() => setShowMenu(false)} className="block px-3 py-2 rounded-input hover:bg-surface/80">⚙️ Configurações</Link>
                <Link href="/integrations" onClick={() => setShowMenu(false)} className="block px-3 py-2 rounded-input hover:bg-surface/80">🔌 Integrações</Link>
                <div className="h-px bg-border1 my-1" />
                <button onClick={logout} className="w-full text-left px-3 py-2 rounded-input hover:bg-red-500/10 text-red-400">↩️ Sair da conta</button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/login" className="glass rounded-btn px-3 py-1.5 hover:border-violet-400/50">Entrar</Link>
            <Link href="/cadastro" className="btn-grad rounded-btn px-3 py-1.5 font-semibold">Cadastrar</Link>
          </div>
        )}
      </div>
    </header>
  );
}
