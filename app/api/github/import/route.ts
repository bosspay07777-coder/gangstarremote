import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { getGhToken } from "@/lib/gh";

function detectFramework(paths: string[]) {
  if (paths.includes("package.json")) return "node";
  if (paths.some(p => p.endsWith(".html"))) return "static";
  return "static";
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { repo, branch } = await req.json();
  const token = await getGhToken(sb, user.id);
  if (!token) return NextResponse.json({ error: "Conecte o GitHub primeiro." }, { status: 400 });
  const H = { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" };
  const infoRes = await fetch(`https://api.github.com/repos/${repo}`, { headers: H });
  if (!infoRes.ok) return NextResponse.json({ error: "repo não encontrado" }, { status: 404 });
  const info = await infoRes.json();
  const br = branch || info.default_branch;
  const treeRes = await fetch(`https://api.github.com/repos/${repo}/git/trees/${br}?recursive=1`, { headers: H });
  const tree = await treeRes.json();
  const blobPaths = (tree.tree || []).filter((t: any) => t.type === "blob" && t.size < 200000 && !/node_modules|\.lock|dist\//.test(t.path)).slice(0, 300);
  const { data: proj, error } = await sb.from("projects").insert({
    user_id: user.id, name: repo.split("/")[1], description: info.description || `Importado de ${repo}`,
    framework: detectFramework(blobPaths.map((b: any) => b.path)), github_repo: repo, github_branch: br, template: "github",
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows: any[] = [];
  for (const t of blobPaths) {
    const r = await fetch(`https://api.github.com/repos/${repo}/git/blobs/${t.sha}`, { headers: H });
    const bj = await r.json();
    if (bj.content) rows.push({ project_id: proj.id, path: t.path, content: Buffer.from(bj.content, "base64").toString("utf-8") });
  }
  if (rows.length) await sb.from("project_files").insert(rows);
  return NextResponse.json({ project: proj, files: rows.length });
}
