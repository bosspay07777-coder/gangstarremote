import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

async function owned(sb: any, id: string, uid: string) {
  const { data: p } = await sb.from("projects").select("*").eq("id", id).eq("user_id", uid).single();
  return p;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const proj = await owned(sb, id, user.id);
  if (!proj) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [{ data: files }, { data: messages }, { data: versions }] = await Promise.all([
    sb.from("project_files").select("*").eq("project_id", id).order("path"),
    sb.from("messages").select("*").eq("project_id", id).order("created_at"),
    sb.from("versions").select("id,label,created_at").eq("project_id", id).order("created_at", { ascending: false }).limit(50),
  ]);
  return NextResponse.json({ project: proj, files, messages, versions });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const patch: any = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) patch.name = body.name;
  if (body.github_repo !== undefined) patch.github_repo = body.github_repo;
  if (body.github_branch !== undefined) patch.github_branch = body.github_branch;
  if (body.supabase_ref !== undefined) patch.supabase_ref = body.supabase_ref;
  const { data, error } = await sb.from("projects").update(patch).eq("id", id).eq("user_id", user.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { error } = await sb.from("projects").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // file ops: {op:'write'|'delete'|'rename', path, content, newPath}
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || !(await owned(sb, id, user.id))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  if (body.op === "write") {
    const { error } = await sb.from("project_files").upsert({ project_id: id, path: body.path, content: body.content }, { onConflict: "project_id,path" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (body.op === "delete") {
    await sb.from("project_files").delete().eq("project_id", id).eq("path", body.path);
  } else if (body.op === "rename") {
    await sb.from("project_files").update({ path: body.newPath }).eq("project_id", id).eq("path", body.path);
  }
  await sb.from("projects").update({ updated_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ ok: true });
}
