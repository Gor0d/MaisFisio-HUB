// Chama uma ferramenta do MCP pela linha de comando: node call-tool.mjs <ferramenta> '{"arg":1}'
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const t = new StdioClientTransport({ command: process.execPath, args: ["server.mjs"], env: { ...process.env } });
const c = new Client({ name: "perm", version: "1" }); await c.connect(t);
const r = await c.callTool({ name: process.argv[2], arguments: JSON.parse(process.argv[3] ?? "{}") });
console.log(r.isError ? "ERRO:" : "OK:", r.content[0].text.slice(0, 100000)); await c.close();
