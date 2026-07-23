# Checklist para conclusão e go-live

Este documento organiza o trabalho restante do MaisFisio HUB. A ordem abaixo deve ser respeitada: itens de segurança e integridade vêm antes de melhorias visuais ou operacionais.

## Como Claude e Codex trabalham neste checklist em paralelo

Convenção simples baseada em texto, sem ferramenta externa — os dois agentes leem e escrevem este arquivo via git:

1. **Antes de começar um item**: `git pull`, confira se ninguém marcou `[~]`, e marque `[~] (SeuNome)` nele nesse mesmo commit (commit só com essa marca, mensagem tipo `wip: reivindica item X`). Isso evita dois agentes começando o mesmo item ao mesmo tempo.
2. **Nunca comece um item marcado `[~]` por outro agente.** Se achar um item `[~]` há muito tempo (sessão anterior encerrada sem concluir), pode assumi-lo — deixe uma nota.
3. **Ao concluir**: marque `[x]`, adicione o hash do commit entre parênteses, rode a suíte (`npm run lint && npm run typecheck && npm test && npm run build`) antes de commitar o trabalho em si.
4. **Prefira itens em arquivos diferentes** para minimizar conflito de merge — a tabela de responsáveis abaixo já foi dividida pensando nisso. Quando dois itens tocarem o mesmo arquivo (ex.: `dashboard-view.tsx`), faça commits pequenos e puxe antes de começar.
5. **Nunca force push** neste repositório. Se der conflito, resolva localmente e faça um commit de merge normal.

### Divisão sugerida (pode mudar; a marca `[~]`/`[x]` no item é o que vale)

| Responsável | Itens |
|---|---|
| **Claude** | Agregação de taxas, truncamentos/paginação, validação de iniciais, coerência de lançamentos no banco, reconciliação da importação, amostras clínicas |
| **Codex** | Cadastro de setores por serviço, gestão de usuários (desativar/reativar/trocar papel), consistência do convite administrativo, catálogo administrativo por papel, filtros e exportação Excel do dashboard, situação da meta nos KPIs |

Itens de P2/P3 (auditoria, recuperação de senha, PDF, PWA, testes formais, go-live) ainda não têm dono — o próximo agente livre reivindica na ordem em que aparecem.

## P0 — Bloqueadores de segurança e acesso

- [x] Corrigir o service worker para nunca armazenar respostas de páginas autenticadas.
  - Feito em 18/07 (commit `8b63b72`), antes desta revisão: só recursos estáticos (`_next/static`, ícone, manifest) são cacheados; páginas sempre vêm da rede e o fallback offline é `/login` sem dados.

- [x] Corrigir o fluxo de usuário inativo. *(commit `cf165ce`)*
  - `signOut()` antes do redirect (o middleware mandava o usuário de volta a `/dashboard` enquanto a sessão continuava válida — loop infinito).
  - Mensagem "Sua conta está inativa..." agora exibida no login (o parâmetro `erro` não era lido antes).

- [x] Fechar a RLS administrativa por unidade. *(commit `cf165ce`, migração `202607210008`)*
  - `profiles`, `collaborators`, `collaborator_aliases` e `indicator_targets` agora exigem unidade compartilhada (via `profile_units`/`collaborator_units`) para admin ler ou gerenciar; meta com `unit_id` nulo (global) exige `super_admin`; admin nunca promove a `super_admin`.
  - Validado com 12 testes reais em produção (2 admins de unidades distintas + super_admin de controle, criados e removidos via `service_role`): nenhum vazamento cross-unit, super_admin preserva acesso global.
  - Formulário de metas (`admin-view.tsx`) ajustado para gravar `unit_id`, senão a nova RLS teria quebrado o cadastro de metas por admin/coordenador.

- [x] Isolar o rascunho local de produção. *(commit `cf165ce`)*
  - Chave do `localStorage` agora inclui `user_id` (`maisfisio:production-draft:<uid>`); em computador compartilhado, o próximo colaborador não recebe mais o rascunho do anterior.

## P1 — Multi-unidade e administração

- [ ] (Codex) Completar o cadastro de setores por serviço.
  - Ao criar um setor, permitir selecionar os serviços habilitados e gravar `service_sectors`.
  - Permitir editar posteriormente os serviços habilitados.
  - Critério de aceite: um setor novo da Santa Terezinha aparece imediatamente nos formulários dos serviços selecionados.

- [ ] (Codex) Completar a gestão de usuários.
  - Desativar e reativar acesso.
  - Alterar papel e serviço com validação de autoridade.
  - Adicionar e remover vínculos em múltiplas unidades.
  - Adicionar e remover vínculos de colaboradores com unidades.
  - Critério de aceite: o administrador consegue executar o ciclo completo sem usar o SQL Editor.
  - Nota: como em `/api/admin/invite/route.ts`, use `service_role` no servidor — a RLS de `profiles` (migração `202607210008`) bloqueia admin alterando `role`/`active` fora da própria unidade por design; a rota deve reforçar isso antes de chamar o client admin, não confiar só na RLS.

- [ ] (Codex) Tornar o convite administrativo consistente.
  - Evitar usuário órfão quando perfil, unidade ou colaborador falhar após o envio do convite.
  - Exibir mensagens amigáveis sem expor detalhes internos do Supabase.
  - Critério de aceite: falha parcial pode ser repetida ou recuperada sem intervenção manual no Auth.

- [x] Corrigir metas por unidade — RLS e gravação de `unit_id` feitos em `cf165ce` (P0). Falta só:
  - [ ] (Codex) Exibir situação da meta (atingida/não atingida) nos KPIs e relatórios.
  - Critério de aceite: dashboard mostra atingida/não atingida comparando o indicador com a meta vigente da unidade.

- [ ] (Codex) Ajustar o catálogo administrativo por papel.
  - Mostrar ações de indicadores globais somente para `super_admin`.
  - Filtrar colaboradores, setores, metas e auditoria pela unidade ativa.
  - Critério de aceite: nenhuma ação visível termina em erro de permissão esperado.

## P1 — Integridade clínica e indicadores

- [~] (Claude) Reforçar a validação das iniciais do paciente.
  - Recusar nome completo tanto no frontend quanto na função SQL.
  - Definir e testar formatos aceitos, como `M. A. S.` ou `MAS`.
  - Critério de aceite: exemplos de nomes completos são recusados e iniciais válidas continuam aceitas.

- [~] (Claude) Validar coerência de lançamentos no banco.
  - Garantir que o contexto do indicador corresponde ao contexto do lançamento.
  - Garantir que setor, colaborador e serviço são compatíveis.
  - Exigir colaborador e número de atendimento nas escalas em que esses campos são obrigatórios.
  - Critério de aceite: payload manipulado pelo cliente não consegue gravar combinações inválidas.

- [~] (Claude) Corrigir agregação de taxas.
  - Não somar percentuais em relatórios.
  - Para taxa derivada, calcular `soma(numerador) / soma(denominador)` com proteção contra zero.
  - Documentar se taxas digitadas serão média simples, ponderada ou substituídas por componentes calculáveis.
  - Critério de aceite: índice mensal da Fono confere manualmente com melhorias totais ÷ altas totais.

- [~] (Claude) Remover truncamentos silenciosos do dashboard e dos relatórios.
  - Substituir limites fixos de 10 mil/20 mil por paginação, agregação SQL ou RPC própria.
  - Garantir que CSV, dashboard e PDF usam o mesmo conjunto completo de dados.
  - Critério de aceite: totais de períodos grandes conferem com consultas diretas no banco.

- [ ] (Codex) Completar os filtros e exportações do dashboard.
  - Adicionar turno e colaborador.
  - Incluir dimensões relevantes no CSV.
  - Adicionar exportação Excel, conforme o plano aprovado.
  - Critério de aceite: filtros combinados alteram KPIs, gráficos e exportação de forma consistente.

## P1 — Importação histórica

- [~] (Claude) Reconciliar relatório e banco após a importação.
  - Explicar e registrar a diferença atual de 19 produções e 51 escalas entre o relatório e o banco.
  - Incluir avaliações descartadas por opções fora do catálogo no relatório final, não apenas no console.
  - Critério de aceite: `aceitas = inseridas + já existentes + rejeitadas na carga`, sem diferenças sem justificativa.

- [~] (Claude) Revisar rejeições reais da Melhoria Funcional UTI.
  - Considerar que 1.085 é o limite físico da aba, mas somente 279 linhas possuem avaliação preenchida.
  - Revisar as 10 avaliações preenchidas que não chegaram às 269 importadas.
  - Atualizar a documentação para não exigir aproximadamente 1.085 avaliações válidas.
  - Critério de aceite: todas as linhas preenchidas estão importadas ou possuem motivo aprovado de rejeição.

- [~] (Claude) Revisar amostras clínicas contra a planilha.
  - Conferir ao menos três pacientes de Barthel, três de MRC e três de Melhoria UTI.
  - Comparar itens, total, entrada, saída e flag de melhora.
  - Critério de aceite: resultados do banco conferem com o cálculo manual e divergências ficam documentadas.

- [ ] Aprovar o relatório de qualidade com a MaisFisio.
  - Revisar nomes de equipe preservados como colaboradores canônicos.
  - Aprovar correções de datas e linhas rejeitadas relevantes.
  - Critério de aceite: responsável da operação registra a aprovação antes do go-live.

## P2 — Auditoria e operação

- [ ] Reduzir o ruído da auditoria automática.
  - Evitar um log de `scale_assessments` para cada resposta que apenas recalcula total e quantidade de itens.
  - Diferenciar ação do usuário, importação e atualização técnica.
  - Definir retenção ou arquivamento para a auditoria, que já possui mais de 250 mil linhas.
  - Critério de aceite: uma avaliação gera um evento clínico útil, sem dezenas de atualizações técnicas.

- [ ] Completar recuperação de senha.
  - Adicionar “Esqueci minha senha” no login.
  - Criar fluxo de envio, callback e definição de nova senha.
  - Critério de aceite: usuário convidado consegue recuperar acesso sem intervenção do administrador.

- [ ] Completar o PDF mensal.
  - Remover o limite dos primeiros 35 indicadores.
  - Incluir unidade, período, filtros, metas e paginação adequada.
  - Critério de aceite: nenhum indicador registrado no período desaparece silenciosamente do PDF.

- [ ] Revisar PWA e instalação em dispositivos reais.
  - Adicionar ícones compatíveis com Android/iOS nos tamanhos necessários.
  - Validar instalação, atualização do service worker e comportamento offline seguro.
  - Critério de aceite: Lighthouse PWA ≥ 90 e instalação aprovada em pelo menos um Android e um iPhone/iPad compatível.

## P2 — Testes obrigatórios antes do go-live

- [ ] Criar usuários de teste para todos os papéis.
  - Um `super_admin`, admins de duas unidades, coordenadores de serviços diferentes e colaboradores.

- [ ] Criar testes de integração RLS contra Supabase de teste.
  - Anônimo não lê dados.
  - Colaborador não acessa administração.
  - Coordenador fica limitado ao serviço e à unidade.
  - Admin fica limitado à unidade.
  - `super_admin` acessa visão consolidada.

- [ ] Criar teste E2E do fluxo principal.
  - Login → lançamento de Fisioterapia → Barthel entrada → Barthel saída → dashboard.
  - Executar em desktop e viewport mobile.
  - Conferir total e flag de melhora.

- [ ] Testar cenários negativos.
  - Data futura, setor de outra unidade, colaborador de outro serviço, respostas incompletas e paciente com nome completo.

- [ ] Executar a suíte final.
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
  - Testes E2E e RLS
  - Lighthouse mobile

## P3 — Go-live e acompanhamento

- [ ] Configurar domínio de produção e URLs permitidas do Supabase Auth.
- [ ] Confirmar cadastro público desabilitado e acesso somente por convite.
- [ ] Configurar senha mínima, proteção contra senhas vazadas e SMTP institucional.
- [ ] Configurar monitoramento do `/api/health` e alertas.
- [ ] Confirmar backups/PITR conforme o plano contratado do Supabase.
- [ ] Distribuir o guia de segurança à equipe.
- [ ] Treinar administradores, coordenadores e colaboradores.
- [ ] Fazer liberação piloto em uma unidade/setor antes da expansão.
- [ ] Acompanhar erros, desempenho e qualidade dos lançamentos na primeira semana.

## Definição de pronto

O sistema só deve ser considerado pronto para uso assistencial quando:

- [ ] Todos os itens P0 e P1 estiverem concluídos.
- [ ] O fluxo E2E principal estiver aprovado em desktop e celular.
- [ ] A RLS estiver comprovada com usuários reais de teste de todos os papéis.
- [ ] Importação e amostras clínicas estiverem reconciliadas e aprovadas.
- [ ] PWA não armazenar dados autenticados e atingir Lighthouse ≥ 90.
- [ ] Operação, recuperação de acesso, monitoramento e backups estiverem confirmados.
