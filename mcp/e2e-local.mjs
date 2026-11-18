// Teste ponta a ponta do MCP contra o ambiente LOCAL (deploy/, porta 8088). Não use com produção.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const transport = new StdioClientTransport({ command: process.execPath, args: ["server.mjs"], cwd: new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"), env: { ...process.env } });
const client = new Client({ name: "teste-local", version: "1.0.0" });
await client.connect(transport);
const tools = await client.listTools(); console.log("ferramentas:", tools.tools.map((t) => t.name).join(", "));
const call = async (name, args = {}) => { const r = await client.callTool({ name, arguments: args }); const text = r.content[0].text; console.log(`\n## ${name}${r.isError ? " (ERRO)" : ""}\n${text.slice(0, 700)}`); return r; };
await call("quem_sou_eu");
await call("listar_setores");
const formula = { nome: "FON - Índice de broncoaspiração - UTI", codigo_interact: "FON-03", numerador: ["fono_broncoaspiracoes"], denominador: ["fono_atendimentos"], setores: ["uti"], multiplicador: 100, unidade_resultado: "%", casas_decimais: 2, meta: 2, tipo_meta: "maximo", observacoes: "Criado via MCP (teste local)." };
await call("previa_indicador_qualidade", { ...formula, mes: "2026-10" });
await call("criar_indicador_qualidade", { ...formula, numerador: ["fisio_taxa_captados"] }); // deve recusar
await call("criar_indicador_qualidade", formula);
await call("criar_indicador_qualidade", formula); // duplicado deve recusar
await call("calcular_indicadores_qualidade", { mes: "2026-10" });
await call("totais_producao", { de: "2026-10-01", ate: "2026-10-31", servico: "fonoaudiologia" });
await client.close();
