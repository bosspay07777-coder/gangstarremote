import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { projectId } = await req.json();
  const { data: proj } = await sb.from("projects").select("*").eq("id", projectId).eq("user_id", user.id).single();
  if (!proj) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data: vercel } = await sb.from("integrations").select("config").eq("user_id", user.id).eq("provider", "vercel").single();
  const vToken = vercel?.config?.token ? decrypt(vercel.config.token) : process.env.VERCEL_TOKEN;
  if (!vToken) return NextResponse.json({ error: "Conecte a Vercel em Integrações (token) antes de publicar." }, { status: 400 });
  const { data: files } = await sb.from("project_files").select("path,content").eq("project_id", projectId);
  if (!files?.length) return NextResponse.json({ error: "projeto sem arquivos" }, { status: 400 });
  const name = (proj.github_repo ? proj.github_repo.split("/")[1] : proj.name).toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 50) || "gangstar-app";
  const body = {
    name,
    files: files.filter(f => f.path !== "PROJECT.md").map(f => ({ file: f.path, data: f.content })),
    projectSettings: { framework: proj.framework === "static" ? null : proj.framework },
    target: "production",
  };
  const res = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST", headers: { authorization: `Bearer ${vToken}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  const url = j.url ? `https://${j.url}` : null;
  await sb.from("deployments").insert({ project_id: projectId, provider: "vercel", url, status: j.error ? "error" : "building", log: JSON.stringify(j).slice(0, 4000) });
  return NextResponse.json({ ok: res.ok, url, error: j.error?.message });
}

export async function GET(_req: Request, { params }: any) {
  return NextResponse.json({ ok: true });
}
