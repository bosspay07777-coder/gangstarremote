import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATES, PROJECT_MD } from "@/lib/templates";
import { NextRequest } from "next/server";

export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await sb.from("projects").select("*").order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const tpl = TEMPLATES[body.template || "blank"] || TEMPLATES.blank;
  const { data: proj, error } = await sb.from("projects").insert({
    name: body.name || "Novo projeto", description: body.description || tpl.desc,
    template: body.template || "blank", framework: body.framework || "static",
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const files = [
    ...(body.files || []),
    ...tpl.files,
    { path: "PROJECT.md", content: PROJECT_MD },
  ];
  await sb.from("project_files").insert(files.map(f => ({ project_id: proj.id, path: f.path, content: f.content })));
  return NextResponse.json({ project: proj });
}
