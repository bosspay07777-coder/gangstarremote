import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  const { data: proj } = await sb.from("projects").select("id,user_id").eq("id", id).eq("user_id", user.id).single();
  if (!proj) return new Response("not found", { status: 404 });
  const { data: files } = await sb.from("project_files").select("path,content").eq("project_id", id);
  const idx = (files || []).find((f: any) => f.path === "index.html");
  return new Response(idx?.content || "<h1>Sem index.html</h1>", { headers: { "content-type": "text/html; charset=utf-8" } });
}
