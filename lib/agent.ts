export type AgentAction = { type: "write" | "delete"; path: string; content?: string };
export const SYSTEM = (files: { path: string }[], projectMd: string) => `Você é um agente autônomo de vibe coding. Você constrói e edita um projeto web editando arquivos diretamente.

ARQUIVOS ATUAIS:
${files.map(f => "- " + f.path).join("\n")}

MEMÓRIA DO PROJETO (PROJECT.md):
${projectMd.slice(0, 2000)}

REGRAS:
1. Para criar/editar arquivos, emita blocos de ação no formato exato:
<action type="write" path="caminho/arquivo.html">
CONTEÚDO COMPLETO DO ARQUIVO
</action>
2. Para apagar: <action type="delete" path="caminho"/>
3. Fora dos blocos de ação, escreva em português explicações curtas do que está fazendo.
4. O preview roda HTML/CSS/JS estático: ponto de entrada é index.html. Escreva código completo e funcional, sem placeholders TODO.
5. Prefira edições cirúrgicas: emita <action> apenas para os arquivos que mudam.
6. Sempre atualize PROJECT.md quando tomar decisões importantes.
7. Se o usuário reportar um erro, corrija o arquivo afetado e explique a correção.`;

export function parseActions(full: string): { text: string; actions: AgentAction[] } {
  const actions: AgentAction[] = [];
  const text = full.replace(/<action\s+type="(\w+)"\s+path="([^"]+)"\s*>\n?([\s\S]*?)<\/action>/g, (_m, type, path, content) => {
    actions.push({ type, path: path.trim(), content: content.replace(/\n$/, "") });
    return "";
  }).replace(/<action\s+type="(\w+)"\s+path="([^"]+)"\s*\/>/g, (_m, type, path) => {
    actions.push({ type, path: path.trim() });
    return "";
  });
  return { text, actions };
}
