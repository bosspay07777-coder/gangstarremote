"use client";
import { useState } from "react";
import { getClient } from "@/lib/supabase/client";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const oauth = async (provider: "google" | "github") => {
    const { error } = await getClient().auth.signInWithOAuth({ provider, options: { redirectTo: location.origin + "/auth/callback" } });
    if (error) setErr(error.message);
  };
  const magic = async () => {
    const { error } = await getClient().auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + "/auth/callback" } });
    if (error) setErr(error.message); else setSent(true);
  };
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="glass rounded-card p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Entrar no GangstarRemote</h1>
        {err && <p className="text-red-400 text-sm mb-4 rounded-input bg-red-500/10 px-4 py-2">{err}</p>}
        {sent ? <p className="text-green-400 text-sm text-center">Link mágico enviado para {email} ✉️</p> : (
          <div className="space-y-3">
            <button onClick={() => oauth("google")} className="w-full glass rounded-btn py-3 hover:border-violet-400/50 transition">Entrar com Google</button>
            <button onClick={() => oauth("github")} className="w-full glass rounded-btn py-3 hover:border-violet-400/50 transition">Entrar com GitHub</button>
            <div className="flex gap-2 items-center py-1"><div className="flex-1 h-px bg-border1" /><span className="text-xs text-muted">ou e-mail</span><div className="flex-1 h-px bg-border1" /></div>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com"
              className="glow w-full bg-transparent border border-border1 rounded-input px-4 py-3 outline-none" />
            <button onClick={magic} disabled={!email} className="btn-grad glow w-full rounded-btn py-3 font-semibold disabled:opacity-40">Enviar link mágico</button>
          </div>
        )}
      </div>
    </main>
  );
}
