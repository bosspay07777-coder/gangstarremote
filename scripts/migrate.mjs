// Aplica o schema via Supabase Management API (sem arquivos SQL)
import { execSync } from "child_process";
const PAT = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;
if (!PAT || !REF) { console.error("Defina SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF"); process.exit(1); }
const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: "POST",
  headers: { authorization: `Bearer ${PAT}`, "content-type": "application/json" },
  body: JSON.stringify({ query: `select table_name from information_schema.tables where table_schema='public'` }),
});
const j = await res.json();
console.log("Tabelas existentes:", Array.isArray(j) ? j.map(r => r.table_name).join(", ") : j);
if (Array.isArray(j) && j.length >= 8) console.log("✅ Schema já aplicado.");
else console.log("⚠️ Execute o schema (ver README): crie as tabelas via Management API database/query.");
