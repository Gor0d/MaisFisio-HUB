# MCP do MaisFisio HUB

Servidor [MCP](https://modelcontextprotocol.io) que deixa um assistente de IA (Claude Desktop, Claude Code ou outro cliente MCP) **criar e calcular indicadores de qualidade (Interact)** e **ler os totais de produção** do HUB.

## Segurança
- Entra como um **usuário do sistema** (e-mail e senha), com a chave pública (`anon`). **Nunca use a `service_role`.**
- A RLS e as validações do banco valem como na tela: só **admin** da unidade ou **matriz** criam, alteram ou calculam indicadores de qualidade; colaborador e coordenador são recusados.
- Use um usuário dedicado (ex.: `ia@seudominio`) com papel `admin` só na unidade necessária. Toda alteração fica no log de auditoria com esse usuário.
- As ferramentas só devolvem **dados agregados**; nenhuma lê dados de pacientes.

## Ferramentas
| Ferramenta | O que faz | Grava? |
|---|---|---|
| `quem_sou_eu` | Usuário, papel e unidades acessíveis | não |
| `listar_indicadores_producao` | Catálogo (códigos) por serviço; por padrão só os que entram em fórmula | não |
| `listar_setores` | Setores da unidade (para filtrar, ex.: `uti`) | não |
| `listar_indicadores_qualidade` | Indicadores cadastrados, com a fórmula em texto e a meta | não |
| `previa_indicador_qualidade` | Calcula uma fórmula proposta para um mês, **sem salvar** | não |
| `criar_indicador_qualidade` | Cadastra o indicador (validado pelo banco, auditado) | sim |
| `atualizar_indicador_qualidade` | Nome, meta, casas, observações, ativar/desativar | sim |
| `calcular_indicadores_qualidade` | Resultado do mês com mês anterior e meta (como a tela Qualidade) | não |
| `totais_producao` | Totais agregados por indicador num período | não |

Fórmula: `soma(numerador) ÷ soma(denominador) × multiplicador` no mês; sem denominador, o resultado é a soma. Só entram indicadores de **contagem** do catálogo.

## Instalação
```bash
cd mcp && npm install
```

### Claude Desktop (`claude_desktop_config.json`) ou Claude Code (`.mcp.json`)
```json
{
  "mcpServers": {
    "maisfisio-hub": {
      "command": "node",
      "args": ["C:/caminho/MaisFisio-HUB/mcp/server.mjs"],
      "env": {
        "MAISFISIO_SUPABASE_URL": "https://app.seudominio.com.br",
        "MAISFISIO_SUPABASE_ANON_KEY": "<chave anon>",
        "MAISFISIO_EMAIL": "ia@seudominio.com.br",
        "MAISFISIO_PASSWORD": "<senha do usuário dedicado>"
      }
    }
  }
}
```
No stack da VPS (`deploy/`), a URL é o próprio domínio (o Caddy encaminha `/auth/v1` e `/rest/v1`). No Supabase gerenciado, use a URL do projeto.

## Exemplo de uso (em linguagem natural)
> "Crie o indicador *FON - Índice de broncoaspiração - UTI*: broncoaspirações ÷ atendimentos da fono, só na UTI, em %, meta máxima de 2%. Antes mostre a prévia de outubro de 2026."

O assistente chama `listar_indicadores_producao` → `listar_setores` → `previa_indicador_qualidade` → `criar_indicador_qualidade`.

## Testes
- `npm test`: regras (período, códigos, conta, metas).
- `node e2e-local.mjs`: ponta a ponta contra o **ambiente local** (`deploy/`, porta 8088), com as variáveis acima apontando para ele. Cria um indicador de teste; não rode contra produção.
- `node call-tool.mjs <ferramenta> '<json>'`: chama uma ferramenta isolada.

## Próximos passos para IA no sistema
- Transporte HTTP (Streamable HTTP) atrás do Caddy, com login por token do próprio usuário, para usar dentro do HUB.
- Ferramentas de análise: tendência de 12 meses, outliers por setor e rascunho de justificativa para metas não atingidas.
