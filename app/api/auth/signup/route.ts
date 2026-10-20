import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  if (!email || typeof email !== "string" || !email.includes("@"))
    return NextResponse.json({ error: "Email inválido." }, { status: 400 });
  if (!password || typeof password !== "string" || password.length < 6)
    return NextResponse.json({ error: "Senha precisa ter no mínimo 6 caracteres." }, { status: 400 });

  const sb = admin();
  // email_confirm: true → cria o usuário JÁ CONFIRMADO, sem enviar email de verificação.
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    const msg = error.message || "Falha ao criar usuário";
    // email duplicado → devolve 409 pra UI poder tentar login
    if (/already|exists|registered|duplicate/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  return NextResponse.json({
    user: { id: data.user?.id, email: data.user?.email },
  });
}
