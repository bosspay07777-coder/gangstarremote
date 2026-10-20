"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getClient } from "@/lib/supabase/client";

export default function Cadastro() {
  const r = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const same = password && password === confirm;
  const canSubmit = email.includes("@") && password.length >= 6 && same;

  const oauth = async (provider: "google" | "github") => {
    setErr("");
    const { error } = await getClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: location.origin + "/auth/callback" },
    });
    if (error) setErr(error.message);
  };

  const submit = async () => {
    setErr("");
    if (!canSubmit) {
      if (password.length < 6) setErr("Senha precisa ter no mínimo 6 caracteres.");
      else if (!same) setErr("As senhas não conferem.");
      return;
    }
    setBusy(true);
    // Bypassa verificação de email: cria o usuário já confirmado via service-role,
    // depois autentica client-side. Sem envio de email de confirmação.
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setBusy(false);
      // 409 = email já existe → tenta só login
      if (res.status === 409) {
        const { error } = await getClient().auth.signInWithPassword({ email, password });
        if (error) { setErr("Email já cadastrado e senha diferente."); return; }
        r.push("/dashboard"); r.refresh();
        return;
      }
      setErr(j.error || "Falha no cadastro");
      return;
    }
    const { error } = await getClient().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    r.push("/dashboard");
    r.refresh();
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="glass rounded-card p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2 text-center">Criar conta</h1>
        <p className="text-muted text-sm text-center mb-6">
          Cadastro direto — <span className="text-violet-400">sem verificação de email</span>.
        </p>

        {err && <p className="text-red-400 text-sm mb-4 rounded-input bg-red-500/10 px-4 py-2">{err}</p>}

        <div className="space-y-3">
          <button onClick={() => oauth("google")} className="w-full glass rounded-btn py-3 hover:border-violet-400/50 transition">Cadastrar com Google</button>
          <button onClick={() => oauth("github")} className="w-full glass rounded-btn py-3 hover:border-violet-400/50 transition">Cadastrar com GitHub</button>

          <div className="flex gap-2 items-center py-1"><div className="flex-1 h-px bg-border1" /><span className="text-xs text-muted">ou email + senha</span><div className="flex-1 h-px bg-border1" /></div>

          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com"
            className="glow w-full bg-transparent border border-border1 rounded-input px-4 py-3 outline-none" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha (mín. 6)"
            className="glow w-full bg-transparent border border-border1 rounded-input px-4 py-3 outline-none" />
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirmar senha"
            onKeyDown={e => { if (e.key === "Enter") submit(); }}
            className="glow w-full bg-transparent border border-border1 rounded-input px-4 py-3 outline-none" />

          <button onClick={submit} disabled={busy || !canSubmit}
            className="btn-grad glow w-full rounded-btn py-3 font-semibold disabled:opacity-40 transition">
            {busy ? "Criando…" : "Criar conta ⚡"}
          </button>

          <p className="text-xs text-muted text-center pt-1">
            Ao cadastrar, você entra imediatamente. Sem email de confirmação.
          </p>

          <p className="text-center text-sm text-muted pt-3">
            Já tem conta? <Link href="/login" className="text-violet-400 hover:underline">Entrar →</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
