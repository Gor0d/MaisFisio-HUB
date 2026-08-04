# Checklist para conclusão e go-live

Este documento organiza o trabalho restante do MaisFisio HUB. A ordem abaixo deve ser respeitada: itens de segurança e integridade vêm antes de melhorias visuais ou operacionais.

## Como Claude e Codex trabalham neste checklist em paralelo

Convenção simples baseada em texto, sem ferramenta externa — os dois agentes leem e escrevem este arquivo via git:

1. **Antes de começar um item**: `git pull`, confira se ninguém marcou `[~]`, e marque `[~] (SeuNome)` nele nesse mesmo commit (commit só com essa marca, mensagem tipo `wip: reivindica item X`). Isso evita dois agentes começando o mesmo item ao mesmo tempo.
2. **Nunca comece um item marcado `[~]` por outro agente.** Se achar um item `[~]` há muito tempo (sessão anterior encerrada sem concluir), pode assumi-lo — deixe uma nota.
3. **Ao concluir**: marque `[x]`, adicione o hash do commit entre parênteses, rode a suíte (`npm run lint && npm run typecheck && npm test && npm run build`) antes de commitar o trabalho em si.
4. **Prefira itens em arquivos diferentes** para minimizar conflito de merge — a tabela de responsáveis abaixo já foi dividida pensando nisso. Quando dois itens tocarem o mesmo arquivo (ex.: `dashboard-view.tsx`), faça commits pequenos e puxe antes de começar.
5. **Nunca force push** neste repositório. Se der conflito, resolva localmente e faça um commit de merge normal.

### Divisão vigente em 01/08 (pode mudar; a marca `[~]`/`[x]` no item é o que vale)

Todos os P0 e todos os P1 (Claude e Codex) estão concluídos. Só resta P2 (operacional, não bloqueia o piloto controlado) e as decisões de negócio.

| Responsável | Itens |
|---|---|
| **Claude** | ~~Agregação de taxas, truncamentos/paginação, validação de iniciais, coerência de lançamentos, reconciliação da importação, amostras clínicas, PDF mensal, recuperação de senha~~ (concluídos) · **em aberto:** ruído da auditoria, PWA (ícones em múltiplos tamanhos + Lighthouse), teste E2E automatizado, cenários negativos formalizados |
| **Codex** | ~~Cadastro de setores por serviço, gestão de usuários, convite administrativo, catálogo por papel, filtros/exportação Excel do dashboard, situação da meta nos KPIs~~ — **todos os 4 itens P1 concluídos em `f473770`, confirmado em produção** |
| **Você (Emerson)** | Ver "Ações pendentes com você", mais abaixo — contas, domínio, pagamento e decisões de negócio que nenhum agente pode tomar. |

Itens de P3 que são só verificação de configuração (não código) ficam com quem chegar primeiro no painel do Supabase/Vercel — não é código, é clicar e confirmar.

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

- [x] (Claude, `b90cec4`) Fechar leitura global residual de `sectors`/`collaborator_units`/`profile_units`. Achado do Codex (`docs/handoff-agentes.md`, 22/07) — a migração `202607210008` fechou a escrita por unidade mas três políticas de leitura continuavam `using (true)`/globais para gestores. Corrigido e testado (4/4 cenários reais).

## P1 — Multi-unidade e administração

- [x] (Codex, `c0a3c3a`) Completar o cadastro de setores por serviço.
  - Ao criar um setor, permitir selecionar os serviços habilitados e gravar `service_sectors`.
  - Permitir editar posteriormente os serviços habilitados.
  - Critério de aceite: um setor novo da Santa Terezinha aparece imediatamente nos formulários dos serviços selecionados.
  - Admin e `super_admin` possuem aba própria de setores; criação e edição são
    atômicas pela função `save_sector_with_services`, que também valida unidade,
    serviços ativos e autoridade. Coberto pela suíte RLS local.

- [x] (Codex, `16ac6c1`) Completar a gestão de usuários.
  - Desativar e reativar acesso.
  - Alterar papel e serviço com validação de autoridade.
  - Adicionar e remover vínculos em múltiplas unidades.
  - Adicionar e remover vínculos de colaboradores com unidades.
  - Critério de aceite: o administrador consegue executar o ciclo completo sem usar o SQL Editor.
  - Nota: como em `/api/admin/invite/route.ts`, use `service_role` no servidor — a RLS de `profiles` (migração `202607210008`) bloqueia admin alterando `role`/`active` fora da própria unidade por design; a rota deve reforçar isso antes de chamar o client admin, não confiar só na RLS.
  - A rota `PATCH /api/admin/users/[userId]` valida sessão, papel, serviço e
    escopo de unidades antes de usar `service_role`; a função
    `admin_update_user_access` repete as regras e atualiza perfil, colaborador e
    ambos os conjuntos de vínculos na mesma transação.
  - A própria conta e contas `super_admin` não podem ser alteradas pela tela.
    Coordenador fica restrito a colaboradores do próprio serviço.

- [x] (Codex, `f473770`) Tornar o convite administrativo consistente.
  - Evitar usuário órfão quando perfil, unidade ou colaborador falhar após o envio do convite.
  - Exibir mensagens amigáveis sem expor detalhes internos do Supabase.
  - Critério de aceite: falha parcial pode ser repetida ou recuperada sem intervenção manual no Auth.
  - Perfil, unidade, colaborador e unidade de atuação agora são provisionados
    por uma única função transacional; falha compensa o usuário recém-criado
    no Auth, e convites pendentes podem ser retomados de forma idempotente.

- [x] Corrigir metas por unidade — RLS e gravação de `unit_id` feitos em `cf165ce` (P0). Falta só:
  - [x] (Codex, `f473770`) Exibir situação da meta (atingida/não atingida) nos KPIs e relatórios.
  - Critério de aceite: dashboard mostra atingida/não atingida comparando o indicador com a meta vigente da unidade.
  - Dashboard, relatório mensal e PDF usam a meta vigente no fim do período,
    priorizando o setor e a unidade ativos sobre a meta global.

- [x] (Codex, `f473770`) Ajustar o catálogo administrativo por papel.
  - Mostrar ações de indicadores globais somente para `super_admin`.
  - Filtrar colaboradores, setores, metas e auditoria pela unidade ativa.
  - Critério de aceite: nenhuma ação visível termina em erro de permissão esperado.
  - Gestores consultam indicadores globais sem ações de escrita; apenas a
    matriz vê ativar/desativar. Dados operacionais e os 100 eventos de
    auditoria são recortados pela unidade ativa.

## P1 — Integridade clínica e indicadores

- [x] (Claude, `f88575a`) Reforçar a validação das iniciais do paciente.
  - Regex novo (SQL `save_scale_assessment` + zod `scaleAssessmentSchema`): aceita `J.R.S`/`M. A. S.` (grupos de 1-2 letras com separador) ou `MAS`/`EGG` (bloco compacto de 2-4 letras); rejeita qualquer palavra de 3+ letras.
  - Limitação documentada no código: um nome curto de verdade tipo "ANA" ainda passaria — não há regex que distinga perfeitamente sem contexto adicional.
  - Testado: 6/6 casos reais em produção (2 nomes completos rejeitados, 4 formatos de iniciais aceitos).

- [x] (Claude, `f88575a`) Validar coerência de lançamentos no banco.
  - Indicador↔contexto, colaborador↔serviço e setor↔serviço (via `service_sectors`) agora checados em `validate_production_unit`/`validate_production_value`; colaborador↔unidade em `validate_assessment_unit`.
  - MRC exige colaborador e nº de atendimento em `save_scale_assessment` (Barthel/Melhoria UTI não têm esse campo na planilha de origem, ficam opcionais).
  - Testado: 11/11 cenários reais em produção (payloads negativos rejeitados, positivos aceitos).

- [x] (Claude, `0d322dc`) Corrigir agregação de taxas.
  - Nova função SQL `production_metrics_totals`: contagem soma; taxa digitada tira média simples (decisão documentada no código — não há numerador/denominador estruturado para ponderar, é limitação herdada da coleta manual); taxa derivada calcula `soma(numerador)/soma(denominador)` com `nullif` contra zero.
  - Testado com dado sintético isolado: soma(8)/soma(10)=80% ≠ média ingênua das razões diárias=75% — a função retorna 80, confirmando que não é média de percentuais.

- [x] (Claude, `0d322dc`) Remover truncamentos silenciosos do dashboard e dos relatórios.
  - KPIs e totais do relatório vêm de `production_metrics_totals` (no máx. 1 linha por indicador ativo, nunca corta).
  - Linhas brutas do gráfico/quebras/CSV/lista de escalas agora usam `lib/supabase/pagination.ts` (`fetchAllRows`, pagina via `.range()`) em vez de `.limit(10000/20000)`.
  - CSV e dashboard usam o mesmo array paginado — não podem divergir.

- [x] (Codex, `f473770`) Completar os filtros e exportações do dashboard.
  - Adicionar turno e colaborador.
  - Incluir dimensões relevantes no CSV.
  - Adicionar exportação Excel, conforme o plano aprovado.
  - Critério de aceite: filtros combinados alteram KPIs, gráficos e exportação de forma consistente.
  - Turno e colaborador entram na agregação SQL dos KPIs e no mesmo recorte
    paginado de gráficos/exports; CSV e Excel incluem unidade, serviço, turno,
    setor, tipo de setor, colaborador, contexto, indicador, tipo e valor.

## P1 — Importação histórica

- [x] (Claude) Reconciliar relatório e banco após a importação.
  - **Causa raiz encontrada e corrigida**: o relatório original contava `scales.length` (parsed, ANTES do filtro de "resposta fora do catálogo" que só roda em `upload()`) em vez do array de fato gravado no banco — as rejeições por catálogo iam só pro console, nunca para `issues`/`summary`. Corrigido em `scripts/import-xlsx.ts`: `upload()` agora devolve o array aceito e empurra cada descarte para `issues` com nível `rejeitada`; dry-run (sem acesso ao catálogo do banco) ganhou um aviso explícito dessa limitação no próprio relatório.
  - **Reconciliação completa dos 19 produções + 51 escalas**: 19 produções e 15 escalas (2 Barthel + 13 MRC) eram lançamentos com data em 2027 — bug já corrigido (`validateDate` passou a rejeitar datas futuras) e as linhas já haviam sido removidas manualmente do banco antes desta investigação. As 36 linhas de Barthel restantes eram exatamente o off-catalog do item acima (confirmado batendo um dry-run fresco pós-fix contra a contagem real do banco: MRC e Melhoria UTI bateram exato, Barthel bateu exato após contar o off-catalog). `19 + 15 + 36 = 51+19` ✓, sem sobra não explicada.
  - Detalhes completos em `docs/handoff-agentes.md`.

- [x] (Claude) Revisar rejeições reais da Melhoria Funcional UTI.
  - Contagem exata por mecanismo: **269 aceitas + 133 rejeitadas com motivo explícito em `issues` (principalmente prontuário/setor/data ausente) + 683 linhas totalmente em branco (puladas antes de qualquer validação, sem gerar issue) = 1.085 linhas físicas**, sem resto.
  - `docs/plano-arquitetura.md`/`AGENTS.md` atualizados para não citarem "~1.085 avaliações válidas" (era confusão entre linhas físicas da aba e avaliações de fato preenchidas — só 402 linhas têm algum dado).

- [x] (Claude) Revisar amostras clínicas contra a planilha.
  - Script comparou 3 pacientes de cada escala (9 no total, incluindo pares entrada/saída) recalculando o total diretamente da planilha com a mesma lógica do importador (`parseScaleSheet`) e comparando com `scale_assessments.total` no banco.
  - **9/9 conferem exatamente** — nenhuma divergência de item, total, entrada, saída ou pontuação.

- [ ] Aprovar o relatório de qualidade com a MaisFisio.
  - Revisar nomes de equipe preservados como colaboradores canônicos.
  - Aprovar correções de datas e linhas rejeitadas relevantes.
  - Critério de aceite: responsável da operação registra a aprovação antes do go-live.

## P2 — Auditoria e operação

- [x] (Claude, `9b25224` + migração `202608030016` aplicada em produção 03/08) Reduzir o ruído da auditoria automática.
  - `write_audit_log()` agora ignora UPDATEs em `scale_assessments` quando só as colunas derivadas (`total`/`answered_items`/`expected_items`/`complete`/`updated_at`) mudaram — elimina as 10-12 linhas técnicas por avaliação, mantendo qualquer edição real auditada.
  - Diferenciação ação do usuário × importação já existe sem coluna nova: `changed_by is null` identifica escrita via `service_role` (script de importação); documentado via `comment on column`.
  - Retenção: `purge_old_audit_logs(12)` agendado via `pg_cron` (todo domingo 3h30), descarta auditoria com mais de 12 meses.
  - Teste novo em `tests/rls.integration.test.ts` prova: avaliação de 2 itens gera 1 linha de auditoria, não 3. Confirmado em produção: função, job `purge-audit-logs` (ativo, `30 3 * * 0`) e extensão `pg_cron` instalados.

- [x] (Claude) Completar recuperação de senha.
  - Link "Esqueci minha senha" no login (`components/login-form.tsx`) leva a `/recuperar-senha` (rota pública nova, liberada em `lib/supabase/proxy.ts`).
  - `requestPasswordReset` (`app/actions/auth.ts`) chama `supabase.auth.resetPasswordForEmail` com o mesmo `redirectTo` já usado e testado pelo convite (`/auth/callback?next=/definir-senha`) — reaproveita o callback e o `PasswordForm` existentes, sem rota nova de callback.
  - Mensagem de sucesso é idêntica exista ou não o e-mail (sem enumeração de usuários); erro 429 do Supabase mostra aviso de limite de tentativas.
  - Copy de `/definir-senha` neutralizada para servir tanto ativação de convite quanto redefinição.
  - Validado: lint/typecheck/21 testes/build ok; rotas `/recuperar-senha` (200) e link no `/login` confirmados via `npm run dev` local. **Não enviei e-mail real de teste** (evitar disparar para uma caixa de verdade sem combinar) — o envio em si reusa a chamada já validada em produção pelo fluxo de convite, mas o clique no link de recuperação real ainda não foi testado ponta a ponta.

- [x] (Claude, `0d322dc` + `f473770`) Completar o PDF mensal.
  - Limite dos 35 indicadores já havia sido removido em `0d322dc` (paginação real: `if (y > 275) doc.addPage()`, sem `.slice()`).
  - Unidade e período no cabeçalho; meta vigente (atingida/não atingida) por indicador entrou via `f473770` (Codex, item da meta nos KPIs), reaproveitada aqui.
  - Confirmado em revisão de 01/08: `components/reports-view.tsx` não tem mais limite de linhas, e os três critérios (unidade, período, metas, paginação) estão cobertos. Não tinha sido percebido como concluído porque ficou marcado `[~]` desde a redivisão de 29/07 — o trabalho de base já existia antes disso.

- [~] (Claude) Revisar PWA e instalação em dispositivos reais.
  - Gerado `public/icon-192.png` (192×192, a partir do ícone institucional 512×512); `manifest.webmanifest` agora expõe 192 e 512, cada um com `purpose: any` e `maskable`. `apple-icon.png` (180×180) já existia e está correto para iOS.
  - **Bug real encontrado e corrigido**: `public/sw.js` ainda listava `/icon.svg` no `APP_SHELL` — arquivo removido desde o rebranding (commit `0084142`, 26/07). `cache.addAll()` falha inteiro se qualquer URL 404, então a instalação do service worker vinha quebrando silenciosamente para qualquer visitante desde então. Corrigido para os arquivos reais (`icon.png`, `icon-192.png`, `apple-icon.png`, `manifest.webmanifest`) e a versão do cache subiu para `v3` para forçar a limpeza do cache antigo quebrado nos navegadores que já tinham instalado.
  - Confirmado manualmente (build de produção local): as 5 URLs do `APP_SHELL` respondem 200; `manifest.webmanifest` válido com os campos exigidos (name, icons 192/512, start_url, display standalone).
  - Lighthouse: a categoria "PWA" foi **descontinuada pelo Google** nas versões recentes (rodei `npx lighthouse` v13 — `installable-manifest`/`service-worker`/`maskable-icon` não existem mais como audits). Rodei o que ainda existe contra `/login`: performance 99, acessibilidade 100, boas práticas 100.
  - **Ainda falta**: o service worker só registra depois do login (`components/service-worker-register.tsx` está no layout protegido) — visitante não autenticado em `/login` não tem SW ativo. Isso é aceitável para este uso (equipe sempre loga antes de instalar), mas documentando a decisão para não ser confundida com bug depois.
  - **Instalar de fato num Android e num iPhone físico só vocês conseguem fazer** — com o bug do `icon.svg` corrigido, a instalação deve funcionar agora; falta o teste real no aparelho.

## P2 — Testes obrigatórios antes do go-live

- [x] (Claude) Criar usuários de teste para todos os papéis — feito de forma ad-hoc em várias sessões (2 admins de unidades distintas, coordenador, colaborador, super_admin), sempre criados e removidos via `service_role` contra produção. **Atenção:** 2 contas ficaram esquecidas no banco entre 23/07 e 29/07 (`teste.integridade.*`, `teste.rls.galileu.*`) — removidas agora (29/07) junto com os 59 registros de auditoria que bloqueavam a exclusão (FK `audit_logs_changed_by_fkey` é `NO ACTION`, não `CASCADE`). Daqui pra frente, scripts de teste devem confirmar a limpeza no fim da sessão, não só no `finally` do próprio script.

- [x] (Codex, `11e2887`) Criar testes de integração RLS em PostgreSQL isolado.
  - Anônimo não lê dados.
  - Colaborador não acessa administração.
  - Coordenador fica limitado ao serviço e à unidade.
  - Admin fica limitado à unidade.
  - `super_admin` acessa visão consolidada.
  - As 12 migrações são aplicadas do zero em PGlite (PostgreSQL real em
    processo), com papéis e `auth.uid()` equivalentes aos do Supabase. Cinco
    cenários executam as políticas de verdade sem tocar no banco de produção.
  - O teste revelou e corrigiu a leitura global restante de `units`,
    `service_sectors` e colaboradores ativos na migração `202607230012`.

- [x] (Claude) Criar teste E2E do fluxo principal.
  - `playwright.config.ts` + `e2e/` (novo): login → lançamento de Fisioterapia (UTI Galileu) → Barthel entrada (pontuação mínima) → Barthel saída (pontuação máxima) → dashboard. Roda em Desktop Chrome e viewport mobile (Pixel 5), `npm run test:e2e`.
  - Não há ambiente de teste separado neste projeto — roda contra o Supabase de produção com um usuário/colaborador/paciente **descartáveis**, criados no `global-setup` e removidos no `global-teardown` (mesma ordem de exclusão documentada no item de usuários de teste abaixo, por causa da FK `audit_logs_changed_by_fkey`). Confirmado sem sobra após rodar (0 usuários/pacientes/colaboradores `e2e.*` remanescentes).
  - Conferência final não usa só a UI: consulta direto `production_values`/`scale_assessments` via `service_role` para confirmar o valor do indicador e o total/melhora da escala (a view `scale_assessment_results` depende de `is_member_of()`/`auth.uid()`, que fica vazio para `service_role` — por isso a leitura é na tabela base, não na view).
  - **Achado real durante a construção do teste, corrigido**: `sector_type` (campo "Tipo de setor", opcional, presente em `lancamento` e nas 3 escalas) usava `z.enum([...]).optional()` no client, que só aceita `undefined` — mas o `<select>` nativo manda `""` quando a opção "Não se aplica"/"Não informado" fica selecionada (seu próprio padrão). Isso bloqueava o envio do formulário inteiro com um erro genérico ("Revise os campos obrigatórios..."), sem apontar o campo culpado, sempre que alguém deixasse "Tipo de setor" no padrão — o caso mais comum na UTI, que não tem essa classificação. O servidor já tratava `""` como nulo (`nullif`), só o client estava mais restrito que o banco. Corrigido em `lib/validation.ts` (`optionalSectorType`). Um teste E2E mecânico (que não "adivinha" preencher campos como um humano faria) achou isso onde validação manual não achou.

- [x] (Claude, `338b122`) Testar cenários negativos — formalizado em `tests/rls.integration.test.ts` (`describe("cenários negativos")`, 7 testes): data futura, setor de outra unidade, colaborador de outro serviço, MRC sem colaborador/atendimento, paciente com nome completo — todos rejeitados como esperado, e um teste extra confirma que os mesmos payloads corrigidos são aceitos (garante que a rejeição é da regra certa, não de outro erro qualquer).
  - **Achado real**: "data futura rejeitada" só existia como restrição do datepicker no cliente — chamando a RPC direto não havia bloqueio nenhum do banco. Migração `202608030017` adiciona `check (record_date <= current_date)`/`check (assessment_date <= current_date)` em `production_records`/`scale_assessments`. Aplicação em produção pendente (SQL Editor do Supabase, mesma limitação de sessão dos outros itens de DDL).

- [ ] Executar a suíte final.
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
  - Testes E2E e RLS
  - Lighthouse mobile

## Ações pendentes com você (nenhum agente pode fazer sozinho)

Consolidado em 29/07 — nada aqui é código, é conta/pagamento/decisão:

- [ ] **E-mails do Daniel Abreu e do Cezar Ferraz** — bloqueia criar as contas do piloto (Coordenador, Fisioterapia, Galileu).
- [ ] **Decisão do domínio** — `maisfisiohub.com.br`, `grupomaisfisio.com.br` ou `maisfisiosaude.com.br` (todas livres, ~R$ 40/ano). Depois disso: registrar + configurar DNS + Vercel + Supabase Auth (posso fazer a parte técnica assim que houver domínio).
- [ ] **Backup gerenciado do Supabase (Pro/PITR)** — hoje só existe o export local; decisão de quando fazer o upgrade de pagamento.
- [ ] **Upgrade Vercel Pro** — planejado pra "mês que vem" junto com o Supabase Pro (conversa de 26/07); hoje está no Hobby.
- [ ] **Conta de SMTP institucional** (ex.: Resend) — necessária pro convite por e-mail e recuperação de senha funcionarem de verdade em produção; hoje o Supabase usa e-mail padrão com limite baixo.
- [ ] **Distribuir o guia de segurança e treinar a equipe** — `docs/guia-seguranca-equipe.md` já existe, falta só enviar pro Daniel/Cezar quando as contas saírem.
- [ ] **Decisão de ampliar o piloto** além de Daniel/Cezar — recuperação de senha já foi concluída (01/08); o principal bloqueio técnico caiu. Recomendo só ampliar depois do SMTP institucional (linha acima), pois hoje o e-mail padrão do Supabase tem limite baixo de envios/hora.

## P3 — Go-live e acompanhamento

Itens de conta/pagamento/decisão foram movidos para "Ações pendentes com você", acima. Aqui ficam só os passos técnicos que dependem deles:

- [ ] Configurar domínio de produção e URLs permitidas do Supabase Auth — depende da decisão do domínio; técnico, faço assim que houver escolha.
- [ ] Confirmar cadastro público desabilitado e acesso somente por convite — checagem de 1 minuto no painel Supabase, qualquer um de nós faz.
- [ ] Configurar senha mínima, proteção contra senhas vazadas e SMTP institucional — SMTP depende da conta (Resend) que está em "Ações pendentes"; o resto é config de painel.
- [ ] Configurar monitoramento do `/api/health` e alertas — ex.: UptimeRobot, gratuito; posso deixar pronto quando quiserem.
- [x] Backup local como redundância extra — `npm run backup:db` + Tarefa Agendada diária (feito `26/07`, ver `scripts/backup-database.mjs`). Backup **gerenciado**/PITR do Supabase continua em "Ações pendentes com você" (decisão de pagamento).
- [ ] Acompanhar erros, desempenho e qualidade dos lançamentos na primeira semana do piloto — conjunto: eu monitoro os logs técnicos, vocês (Daniel/Cezar) reportam o que sentirem no dia a dia.

## Definição de pronto

O sistema só deve ser considerado pronto para uso assistencial quando:

- [ ] Todos os itens P0 e P1 estiverem concluídos.
- [ ] O fluxo E2E principal estiver aprovado em desktop e celular.
- [ ] A RLS estiver comprovada com usuários reais de teste de todos os papéis.
- [ ] Importação e amostras clínicas estiverem reconciliadas e aprovadas.
- [ ] PWA não armazenar dados autenticados e atingir Lighthouse ≥ 90.
- [ ] Operação, recuperação de acesso, monitoramento e backups estiverem confirmados.
