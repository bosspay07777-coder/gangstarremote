export type TemplateFile = { path: string; content: string };
const LANDING_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Landing</title><style>body{margin:0;font-family:Inter,sans-serif;background:#0b0b12;color:#fff}.hero{padding:80px 24px;text-align:center;background:linear-gradient(135deg,#8b5cf6,#3b82f6,#ec4899);border-radius:0 0 32px 32px}h1{font-size:44px;margin:0 0 12px}p{color:#cbd5e1;font-size:18px}.btn{display:inline-block;margin-top:24px;padding:14px 32px;border-radius:12px;background:#fff;color:#111;font-weight:600;text-decoration:none}</style></head><body><div class="hero"><h1>Sua Landing Page</h1><p>Construída pelo agente de IA. Peça alterações no chat.</p><a class="btn" href="#">Começar</a></div></body></html>`;
export const TEMPLATES: Record<string, { label: string; desc: string; icon: string; files: TemplateFile[] }> = {
  blank: { label: "Em branco", desc: "Comece do zero", icon: "📄", files: [{ path: "index.html", content: "<!DOCTYPE html><html><body><h1>Novo projeto</h1></body></html>" }] },
  landing: { label: "Landing Page", desc: "Página de captura moderna", icon: "🚀", files: [{ path: "index.html", content: LANDING_HTML }] },
  saas: { label: "SaaS", desc: "App SaaS com pricing", icon: "💼", files: [{ path: "index.html", content: LANDING_HTML.replace("Sua Landing Page", "Meu SaaS") }] },
  dashboard: { label: "Dashboard", desc: "Painel com métricas", icon: "📊", files: [{ path: "index.html", content: `<!DOCTYPE html><html><head><title>Dashboard</title><style>body{margin:0;font-family:Inter,sans-serif;background:#0b0b12;color:#fff;display:grid;grid-template-columns:220px 1fr;height:100vh}.side{background:#13131c;padding:24px;border-radius:0 24px 0 0}main{padding:32px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{background:#1a1a26;border:1px solid #ffffff18;border-radius:16px;padding:24px}.card b{font-size:28px;display:block;margin-top:8px}</style></head><body><aside class="side"><h3>Menu</h3></aside><main><h1>Dashboard</h1><div class="cards"><div class="card">Receita<b>R$ 12.400</b></div><div class="card">Usuários<b>1.208</b></div><div class="card">Conversão<b>3,4%</b></div></div></main></body></html>` }] },
  ecommerce: { label: "E-commerce", desc: "Loja com produtos", icon: "🛒", files: [{ path: "index.html", content: LANDING_HTML.replace("Sua Landing Page", "Minha Loja").replace("Começar", "Ver produtos") }] },
  blog: { label: "Blog", desc: "Blog minimalista", icon: "✍️", files: [{ path: "index.html", content: LANDING_HTML.replace("Sua Landing Page", "Meu Blog") }] },
  crm: { label: "CRM", desc: "Gestão de clientes", icon: "🤝", files: [{ path: "index.html", content: LANDING_HTML.replace("Sua Landing Page", "Meu CRM") }] },
};
export const PROJECT_MD = `# PROJECT.md — Memória do projeto
## Objetivo
(descreva aqui o que o app faz)
## Stack
## Decisões
`;
