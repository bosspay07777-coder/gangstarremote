"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getClient } from "@/lib/supabase/client";

export default function Login() {
  const r = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentMagic, setSentMagic] = useState(false);

  const oauth = async (provider: "google" | "github") => {
    setErr("");
    const { error } = await getClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: location.origin + "/auth/callback" },
    });
    if (error) setErr(error.message);
  };

  const enterPassword = async () => {
    setErr("");
    if (!email || !password) return;
    setBusy(true);
    const { error } = await getClient().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setErr(error.message);
    else { r.push("/dashboard"); r.refresh(); }
  };

  const sendMagic = async () => {
    setErr("");
    if (!email) return;
    setBusy(true);
    const { error } = await getClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.origin + "/auth/callback" },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setSentMagic(true);
  };

  const recover = async () => {
    setErr("");
    if (!email) return;
    const { error } = await getClient().auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + "/auth/callback",
    });
    if (error) setErr(error.message);
    else setSentMagic(true);
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="glass rounded-card p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2 text-center">Entrar</h1>
        <p className="text-muted text-sm text-center mb-6">Acesse sua conta no GangstarRemote.</p>

        {err && <p className="text-red-400 text-sm mb-4 rounded-input bg-red-500/10 px-4 py-2">{err}</p>}
        {sentMagic && (
          <p className="text-green-400 text-sm mb-4 rounded-input bg-green-500/10 px-4 py-2">
            ✉️ Link enviado para {email}. Confira o email (e o spam).
          </p>
        )}

        <div className="space-y-3">
          <button onClick={() => oauth("google")} className="w-full glass rounded-btn py-3 hover:border-violet-400/50 transition">Entrar com Google</button>
          <button onClick={() => oauth("github")} className="w-full glass rounded-btn py-3 hover:border-violet-400/50 transition">Entrar com GitHub</button>

          <div className="flex gap-2 items-center py-1"><div className="flex-1 h-px bg-border1" /><span className="text-xs text-muted">ou email + senha</span><div className="flex-1 h-px bg-border1" /></div>

          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com"
            className="glow w-full bg-transparent border border-border1 rounded-input px-4 py-3 outline-none" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Sua senha"
            onKeyDown={e => { if (e.key === "Enter") enterPassword(); }}
            className="glow w-full bg-transparent border border-border1 rounded-input px-4 py-3 outline-none" />

          <button onClick={enterPassword} disabled={busy || !email || !password}
            className="btn-grad glow w-full rounded-btn py-3 font-semibold disabled:opacity-40 transition">
            {busy ? "…" : "Entrar ⚡"}
          </button>

          <div className="flex justify-between pt-2 text-sm">
            <button onClick={sendMagic} disabled={!email} className="text-violet-400 hover:underline disabled:opacity-40">Enviar link mágico</button>
            <button onClick={recover} disabled={!email} className="text-muted hover:underline disabled:opacity-40">Esqueci a senha</button>
          </div>

          <p className="text-center text-sm text-muted pt-4">
            Não tem conta? <Link href="/cadastro" className="text-violet-400 hover:underline">Criar agora →</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
