import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

const PAT = () => process.env.SUPABASE_ACCESS_TOKEN || "";

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const kind = new URL(req.url).searchParams.get("kind") || "projects";
  const ref = new URL(req.url).searchParams.get("ref");
  if (kind === "projects") {
    const res = await fetch("https://api.supabase.com/v1/projects", { headers: { authorization: `Bearer ${PAT()}` } });
    const list = await res.json();
    return NextResponse.json({ projects: (Array.isArray(list) ? list : []).map((p: any) => ({ id: p.id, name: p.name, status: p.status })) });
  }
  if (kind === "tables" && ref) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST", headers: { authorization: `Bearer ${PAT()}`, "content-type": "application/json" },
      body: JSON.stringify({ query: "select table_name from information_schema.tables where table_schema='public' order by table_name" }),
    });
    const j = await res.json();
    return NextResponse.json({ tables: Array.isArray(j) ? j.map((r: any) => r.table_name) : j });
  }
  return NextResponse.json({ error: "bad kind" }, { status: 400 });
}

export async function POST(req: NextRequest) { // run SQL (confirmado no painel do projeto)
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { ref, sql } = await req.json();
  if (!ref || !sql) return NextResponse.json({ error: "ref e sql obrigatórios" }, { status: 400 });
  const destructive = /\b(drop|truncate|delete\b(?!\s+from\s+supabase)|alter\s+table)/i.test(sql);
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { authorization: `Bearer ${PAT()}`, "content-type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const j = await res.json();
  return NextResponse.json({ ok: res.ok, result: j, destructive_hint: destructive ? "Operação potencialmente destrutiva — revise o SQL." : null });
}
