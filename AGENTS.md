# MaisFisio WEB — Instruções para o agente de implementação

## O que é este projeto
Sistema web (desktop + celular) de indicadores assistenciais para a MaisFisio no Hospital Público Estadual Galileu, substituindo a coleta por planilha (`Hospital Público Estadual Galileu - Produção Assistencial.xlsx`, na raiz — NÃO modificar nem apagar este arquivo; é a fonte dos dados históricos).

## Estado atual: MVP pronto, em fase de hardening para go-live
O MVP (fases 1–3 abaixo) está implementado, com dados reais importados no Supabase de produção. **A lista de trabalho ativa agora é `docs/todo-go-live.md`** — leia esse arquivo primeiro, não este. Ele tem uma convenção de reivindicar itens com `[~] (SeuNome)` para Claude e Codex trabalharem em paralelo sem colidir; siga-a antes de tocar em qualquer item.

## Documentos de referência (ler antes de codificar)
- `docs/todo-go-live.md` — **lista de tarefas ativa**, priorizada, com convenção de coordenação entre agentes
- `docs/plano-arquitetura.md` — plano aprovado: arquitetura, modelo de dados, telas, fases, verificação
- `docs/indicadores.md` — catálogo completo dos indicadores por serviço e definições exatas das escalas Barthel, MRC e Melhoria Funcional da UTI (textos e pontuações para o seed)

## Stack (decidida — não trocar)
- **Next.js 15+ (App Router) + TypeScript + Tailwind + shadcn/ui**, PWA (manifest + service worker)
- **Supabase**: PostgreSQL + Auth + RLS; migrações SQL em `supabase/migrations/`, seed em `supabase/seed.sql`
- Formulários: react-hook-form + zod · Gráficos: Recharts · Import: SheetJS (xlsx) em `scripts/import-xlsx.ts`
- Deploy: Vercel (app) + Supabase cloud (dados)

## Regras de domínio essenciais
1. **Multi-unidade (multi-tenant)**: tabela `units` (Hospital Galileu, Santa Terezinha, futuras). Setores, pacientes, lançamentos e avaliações pertencem a uma unidade; catálogos clínicos (serviços, indicadores, escalas) são globais. Profissional pode atuar em várias unidades (`collaborator_units`); acesso de usuário por unidade (`profile_units`). Papel `super_admin` = matriz, enxerga tudo; `admin` = unidade. Prontuário é único por (unidade, número).
2. **Totais e flags de melhora das escalas são sempre calculados**, nunca digitados (Barthel 0–100; MRC 0–60; Melhoria UTI máx. 33; melhora = saída > entrada do mesmo paciente).
3. **Colaborador e setor são dropdowns** (tabelas `collaborators` e `sectors`), nunca texto livre — essa é a principal causa de sujeira na planilha atual.
4. **Indicadores são dados, não colunas**: tabela `indicators` + `production_values` (EAV controlado). Adicionar indicador novo = INSERT no seed, sem migração de schema.
5. **LGPD**: paciente identificado só por iniciais + nº de registro/prontuário + idade. Nunca nome completo. Service worker não pode cachear páginas autenticadas.
6. Taxas derivadas (ex.: índice de melhoria da Fono = melhorias ÷ altas) calculadas em views SQL com proteção contra divisão por zero.
7. Turnos: MANHÃ / TARDE / NOITE. Tipos de setor: Médica / Ortopédica / Cirúrgica.
8. Uso interno da equipe: sem cadastro público, sem indexação (robots noindex); segurança = convite + RLS por unidade.

## Fases (implementar nesta ordem)
1. **MVP**: scaffold + migrações + seed + auth/papéis (admin, coordenador, colaborador) + lançamento de produção da Fisioterapia + 3 escalas + dashboard + `scripts/import-xlsx.ts`
2. Terapia Ocupacional (3 contextos) + Fonoaudiologia
3. Psicologia (geral + UTI) + Assistência Social
4. Metas por indicador, relatórios PDF, auditoria

## Verificação mínima antes de considerar pronto
- Fluxo completo no navegador (desktop e viewport mobile): login → lançamento Fisio → Barthel entrada/saída do mesmo paciente → total e flag de melhora corretos no dashboard
- Importação: contagens no banco ≈ planilha (Barthel ~17.052, MRC ~17.909, Fisio ~8.051, Melhoria UTI ~1.085) + relatório de linhas rejeitadas/corrigidas
- RLS testada: colaborador não acessa administração; anônimo não lê nada

## Idioma
Toda a interface, mensagens e documentação em **português (pt-BR)**. Código (variáveis, tabelas) em inglês.
