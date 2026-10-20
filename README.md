# GangstarRemote — Plataforma de Vibe Coding

Plataforma estilo Lovable: construa, importe, edite e publique apps conversando com um agente de IA autônomo.

## Stack
Next.js 15 (App Router) + TypeScript + Tailwind + Framer Motion + Monaco Editor · Supabase (Auth, Postgres, RLS) · SSE streaming · LLMs (OpenAI, Anthropic, Gemini, OpenRouter — BYOK).

## Rodar localmente
```bash
npm install
cp .env.example .env.local   # preencha com as credenciais do seu Supabase
npm run dev
```

## Schema do banco
O schema (8 tabelas com RLS: profiles, projects, project_files, messages, versions, integrations, secrets, deployments) é criado **via API do Supabase** — sem arquivos SQL no repositório:

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...
node scripts/migrate.mjs   # aplica o schema via Management API
```

## Fluxos reais implementados
- **Criar via chat**: prompt → agente LLM (streaming SSE) → arquivos criados no Supabase → preview ao vivo
- **Importar do GitHub**: OAuth/token → lista repositórios → importa arquivos da branch → detecta framework
- **Templates + Upload ZIP**
- **Commit/Push GitHub**: cria blobs/tree/commit via API Git do GitHub
- **Supabase**: painel SQL executado via Management API (sem arquivos SQL)
- **Publicar**: deploy Vercel via API (token em Integrações)
- **Histórico**: versões com snapshot e restauração

## Onde configurar chaves externas
| Chave | Onde | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY` | `.env.local` / Vercel | Auth e dados da plataforma |
| `SUPABASE_ACCESS_TOKEN` | `.env.local` / Vercel | Painel "Banco de Dados" (SQL via API) |
| `ENCRYPTION_KEY` | `.env.local` / Vercel | Criptografia AES-256 das chaves BYOK |
| `GITHUB_CLIENT_ID/SECRET` | GitHub OAuth App → callback `/api/github/callback` | OAuth GitHub |
| `GITHUB_TOKEN` (fallback) | `.env.local` | Commit/push se OAuth não configurado |
| `OPENAI_API_KEY` etc. | `.env.local` ou BYOK em /integrations | Agente de IA |
| `VERCEL_TOKEN` | BYOK em /integrations ou env | Botão Publicar |

## Deploy na Vercel
1. Importe o repositório na Vercel
2. Configure todas as variáveis do `.env.example` em Project → Settings → Environment Variables
3. No Supabase: Authentication → URL Configuration → adicione `https://SEU-DOMINIO/auth/callback`
