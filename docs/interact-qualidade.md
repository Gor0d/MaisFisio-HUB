# Módulo Qualidade (Interact)

Permite à equipe cadastrar a fórmula de cada indicador do portal de qualidade (Interact Suite) a partir dos indicadores de **contagem** que o HUB já coleta, calcular o resultado mensal automaticamente e exportar para lançar no portal.

## Como funciona

- **Cadastro** (`quality_indicators`): nome (igual ao do portal), código no Interact, serviço (organização), unidade, numerador (soma de um ou mais indicadores de contagem), denominador opcional, fator (×100, ×1.000 ou ×1), casas decimais, setores considerados (vazio = todos), meta mínima/máxima e observações.
- **Cálculo** (`quality_indicator_results(p_start, p_end, p_unit)`): soma do numerador ÷ soma do denominador × fator (nunca a média de razões diárias). Devolve também o nº de lançamentos que contribuíram. Resultado **nulo** (não zero) quando falta lançamento ou o denominador soma zero; a tela mostra o motivo.
- **Tela** `/qualidade`: aba "Cálculo mensal" (competência, resultado, mês anterior, meta atingida ou não, copiar resultado, exportar CSV/Excel) e aba "Cadastro de indicadores".
- **Acesso:** somente `admin` da unidade e `super_admin`. Coordenador e colaborador não leem (a RLS deles é por serviço e o cálculo cruza serviços, então veriam números parciais).
- **Integridade:** gatilho valida que numerador e denominador são indicadores de contagem do catálogo, sem repetição, e que os setores pertencem à unidade; nome único por unidade; criação e edição vão para a trilha de auditoria.

## Arquivos

| Arquivo | Papel |
|---|---|
| `supabase/migrations/202611070018_quality_indicators.sql` | Tabela, validação, RLS, função de cálculo |
| `lib/quality.ts` | Períodos, formatação, situação da meta, linhas de exportação |
| `components/quality-view.tsx`, `app/(protected)/qualidade/page.tsx` | Interface |
| `tests/quality.test.ts`, `tests/quality.integration.test.ts` | 9 testes unitários + 7 de banco (PGlite) |

## Estado e pendências

- As fórmulas dos 5 indicadores usados nos testes (PSI atendimentos, PSI elegibilidade, PSI usuários avaliados, FON broncoaspiração UTI, SS atendimentos) são **provisórias**: vieram do nome visto no portal e aguardam as fichas técnicas.
- Entrega atual = conferência + cópia + exportação. Integração direta depende de importação/API do Interact (não confirmada).
- Migração **não aplicada em produção**.
