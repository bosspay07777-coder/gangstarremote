import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { NextRequest } from "next/server";
import { getGhToken } from "@/lib/gh";

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const token = await getGhToken(sb, user.id);
  if (!token) return NextResponse.json({ error: "Conecte o GitHub em Integrações." }, { status: 400 });
  const q = new URL(req.url).searchParams.get("q") || "";
  const res = await fetch(`https://api.github.com/user/repos?per_page=100&sort=updated${q ? "" : ""}`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) return NextResponse.json({ error: (await res.json()).message }, { status: res.status });
  let repos = await res.json();
  if (q) repos = repos.filter((r: any) => r.full_name.toLowerCase().includes(q.toLowerCase()));
  return NextResponse.json({ repos: repos.map((r: any) => ({ full_name: r.full_name, private: r.private, default_branch: r.default_branch, description: r.description, updated_at: r.updated_at })) });
}

export async function POST(req: NextRequest) { // commit & push files
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { projectId, repo, branch, commitMessage } = await req.json();
  const { data: proj } = await sb.from("projects").select("*").eq("id", projectId).eq("user_id", user.id).single();
  if (!proj) return NextResponse.json({ error: "not found" }, { status: 404 });
  const token = await getGhToken(sb, user.id);
  if (!token) return NextResponse.json({ error: "GitHub não conectado" }, { status: 400 });
  const H = { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json" };
  try {
    const refRes = await fetch(`https://api.github.com/repos/${repo}/git/ref/heads/${branch}`, { headers: H });
    if (!refRes.ok) return NextResponse.json({ error: `branch ${branch} não encontrada` }, { status: 400 });
    const ref = await refRes.json();
    let baseSha = ref.object.sha;
    const commitRes = await fetch(`https://api.github.com/repos/${repo}/git/commits/${baseSha}`, { headers: H });
    const baseCommit = await commitRes.json();
    const treeRes = await fetch(`https://api.github.com/repos/${repo}/git/trees`, { method: "POST", headers: H, body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: [] }) });
    // build tree with blobs
    const { data: files } = await sb.from("project_files").select("path,content").eq("project_id", projectId);
    const tree: any[] = [];
    for (const f of files || []) {
      if (f.path === "PROJECT.md" && (files || []).length > 2) continue;
      const blob = await fetch(`https://api.github.com/repos/${repo}/git/blobs`, { method: "POST", headers: H, body: JSON.stringify({ content: f.content, encoding: "utf-8" }) });
      const bj = await blob.json();
      if (bj.sha) tree.push({ path: f.path, mode: "100644", type: "blob", sha: bj.sha });
    }
    const newTree = await (await fetch(`https://api.github.com/repos/${repo}/git/trees`, { method: "POST", headers: H, body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree }) })).json();
    const newCommit = await (await fetch(`https://api.github.com/repos/${repo}/git/commits`, { method: "POST", headers: H, body: JSON.stringify({ message: commitMessage || "feat: atualização do agente", tree: newTree.sha, parents: [baseSha] }) })).json();
    await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${branch}`, { method: "PATCH", headers: H, body: JSON.stringify({ sha: newCommit.sha }) });
    return NextResponse.json({ ok: true, sha: newCommit.sha, url: `https://github.com/${repo}/commit/${newCommit.sha}` });
  } catch (e: any) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}
