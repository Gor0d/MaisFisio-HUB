# MaisFisio WEB — Instruções para o agente de implementação

## O que é este projeto
Sistema web (desktop + celular) de indicadores assistenciais para a MaisFisio no Hospital Público Estadual Galileu, substituindo a coleta por planilha (`Hospital Público Estadual Galileu - Produção Assistencial.xlsx`, na raiz — NÃO modificar nem apagar este arquivo; é a fonte dos dados históricos).

## Documentos de referência (ler antes de codificar)
- `docs/plano-arquitetura.md` — plano aprovado: arquitetura, modelo de dados, telas, fases, verificação
- `docs/indicadores.md` — catálogo completo dos indicadores por serviço e definições exatas das escalas Barthel, MRC e Melhoria Funcional da UTI (textos e pontuações para o seed)

## Stack (decidida — não trocar)
- **Next.js 15+ (App Router) + TypeScript + Tailwind + shadcn/ui**, PWA (manifest + service worker)
- **Supabase**: PostgreSQL + Auth + RLS; migrações SQL em `supabase/migrations/`, seed em `supabase/seed.sql`
- Formulários: react-hook-form + zod · Gráficos: Recharts · Import: SheetJS (xlsx) em `scripts/import-xlsx.ts`
- Deploy: Vercel (app) + Supabase cloud (dados)

## Regras de domínio essenciais
1. **Totais e flags de melhora das escalas são sempre calculados**, nunca digitados (Barthel 0–100; MRC 0–60; Melhoria UTI máx. 33; melhora = saída > entrada do mesmo paciente).
2. **Colaborador e setor são dropdowns** (tabelas `collaborators` e `sectors`), nunca texto livre — essa é a principal causa de sujeira na planilha atual.
3. **Indicadores são dados, não colunas**: tabela `indicators` + `production_values` (EAV controlado). Adicionar indicador novo = INSERT no seed, sem migração de schema.
4. **LGPD**: paciente identificado só por iniciais + nº de registro/prontuário + idade. Nunca nome completo.
5. Taxas derivadas (ex.: índice de melhoria da Fono = melhorias ÷ altas) calculadas em views SQL com proteção contra divisão por zero.
6. Turnos: MANHÃ / TARDE / NOITE. Tipos de setor: Médica / Ortopédica / Cirúrgica.

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
