# MaisFisio WEB — Sistema Online de Indicadores Assistenciais

## Contexto

A MaisFisio coleta a produção assistencial do **Hospital Público Estadual Galileu** hoje via planilha (Google Forms → Excel → B.I.). O objetivo é transformar isso em um **sistema web** (desktop + celular), com alta disponibilidade e armazenamento completo dos dados, cobrindo todos os serviços e as escalas **Barthel** e **MRC**.

Fonte analisada: `Hospital Público Estadual Galileu - Produção Assistencial.xlsx` (16 abas, ~70 mil registros desde 2023).

**Decisões do usuário (via AskUserQuestion):**
- Stack: **Next.js + Supabase** (PostgreSQL gerenciado)
- MVP: **Fisioterapia + Escalas (Barthel, MRC, Melhoria Funcional UTI)**; demais serviços em fases seguintes — mas o modelo de dados já nasce preparado para todos
- Hospedagem: **nuvem gerenciada** (Vercel + Supabase)
- Histórico: **importar tudo**, com limpeza de dados

---

## 1. Inventário completo dos indicadores (extraído da planilha)

Todas as abas de produção compartilham as dimensões: **DATA, COLABORADOR(A), TURNO (Manhã/Tarde/Noite), SETOR, TIPO DE SETOR (Médica/Ortopédica/Cirúrgica)**.

Setores (aba oculta "Setores"): Fisioterapia usa `UTI, Enfermaria Azul/Laranja/Amarela/Verde`; demais serviços usam `Clínica Verde/Amarela/Laranja/Azul, UTI, Ambulatório`.

### 1.1 Fisioterapia (aba "Fisioterapia", ~8.000 linhas, 24 indicadores)
Pacientes Internados; Pacientes Prescritos; Taxa de pacientes captados; Altas; Intubações; Nº de quedas da fisioterapia; Taxa de efetividade nas Extubações Programadas; Óbitos; PCR; Taxa de Fisioterapia Respiratória; Taxa de Fisioterapia Motora; Nº paciente-dia com via aérea artificial; Taxa de pacientes com via aérea artificial aspirados; Nº pacientes com expectativa de sedestação; Taxa de Sedestações; Nº pacientes com expectativa de ortostatismo; Taxa de Ortostatismo; Taxa de Deambulação; Pronação; Nº pacientes em oxigenoterapia; Visita Multidisciplinar; Taxa de VNI; Taxa de VM Invasiva; Traqueostomia; Nº pacientes que não deambulavam.

### 1.2 Terapia Ocupacional (3 contextos)
- **Atendimento** (~4.000 linhas): Visita Multidisciplinar; Palestra Educação em Saúde; Treinamento; Totais de Atendimentos; Órtese de Descompressão; Órtese de Posicionamento; Prótese.
- **Enfermaria** (~4.100 linhas): Atendimentos nas clínicas; Atendimento ao Familiar; Visita Multidisciplinar; Atividade em Grupo; Altas da enfermaria; Adesões ao plano Terapêutico; Pacientes com efetividade na diminuição da dor; Altas com orientação da T.O.; Totais de Atendimentos; Órteses (2 tipos); Prótese; Tópicos de Interconsultas.
- **Ambulatório** (~1.000 linhas): Interconsultas; Atendimentos em Grupo; Atendimento Individualizado; Adesão ao plano terapêutico; Altas do ambulatório; Efetividade na diminuição da dor (2 métricas); Taxa de ganho funcional; Totais de Atendimentos; Órteses (2 tipos); Prótese.

### 1.3 Psicologia (2 contextos)
- **Geral "Psicologia - 2026"** (~10.000 linhas): Atendimentos Realizados; Admissões; Critério de Elegibilidade Admissão; Acompanhamento Psicológico; Visita Especial; Encaminhamento Externo; Interconsulta; Visita Multidisciplinar; Atendimento Familiar; Protocolo Risco de Suicídio; Nº usuários avaliados; Acolhimento familiar em situação de óbito.
- **UTI** (~1.000 linhas): subconjunto do geral (sem Visita Especial/Interconsulta/Critério de Elegibilidade).

### 1.4 Fonoaudiologia (~4.000 linhas)
Atendimentos Realizados; Atendimento Familiar; Visita Multidisciplinar; Interconsulta; Broncoaspirações; Pacientes com Melhorias na Fonoterapia; Altas da Fono; Índice de melhoria (= melhorias/altas — hoje quebra com `#DIV/0!`).

### 1.5 Assistência Social (~11.000 linhas)
Atendimentos Realizados; Acolhimento; Ambulatório admissão; Orientação de TFD; Acionamento Familiar; Acionamento à rede externa; Visita Multidisciplinar; Alta hospitalar/programada; Pacientes avaliados; Permanência ≥6h pós-alta médica; Internados sem suporte sociofamiliar; Evasões; Acompanhamentos Serviço Social/Psicologia; Acionamentos médicos por tentativa de evasão; Acionamento de transporte social; Acolhimento familiar em óbito.

### 1.6 Escalas clínicas (avaliação por paciente, entrada vs. saída)
- **Escala de Barthel** (~17.000 linhas): 10 domínios — Alimentação (0/5/10), Banho (0/3/5), Higiene Pessoal (0/5), Vestir (0/5/10), Intestino (0/5/10), Sistema Urinário (0/5/10), Uso do Toilet (0/5/10), Transferência (0/5/10/15), Mobilidade (0/5/10/15), Escadas (0/5/10). Total 0–100. Campos: data, iniciais do paciente, registro, entrada/saída, setor, indicador "Melhora?" (comparação saída vs. entrada).
- **MRC** (~18.000 linhas): 12 grupos musculares (abdutores de ombro, flexores de cotovelo, extensores de pulso, flexores de quadril, extensores de joelho, dorsiflexores do pé — esquerdo e direito), grau 0–5 cada ("Grau 0: Sem contração visível" … "Grau 5: Normal"). Total 0–60. Campos: data, colaborador, iniciais, nº atendimento, entrada/saída, setor, tipo do setor, "Apresentou Melhora?".
- **Melhoria Funcional da UTI** (~1.100 linhas): Glasgow (3/7/15), Força Muscular (0–5), Capacidade de Respiração (VM=1 / O2 suplementar=2 / espontânea=3), Mobilidade (0–10). Score composto (soma, máx. 33) + flag "Melhoria?". Campos: paciente, prontuário, idade, CID, tipo de setor, entrada/saída, data entrada/saída UTI, observações.

### 1.7 Problemas de qualidade encontrados (o sistema deve prevenir/corrigir)
- Datas mistas: seriais Excel (45175) e texto digitado errado ("21/03/0202", "09/03/0204", "23/08/0224")
- Colaboradores como texto livre: duplicatas por grafia ("DANILO SOUZA"/"danilo souza", "EVELYN/ NATALIA", espaços extras)
- Fórmulas quebradas (`#DIV/0!`), colunas de pontuação parcialmente preenchidas, valores "-" em campos numéricos
- Setor vazio em várias linhas (T.O. Ambulatório)

---

## 2. Arquitetura

```
[PWA Next.js (Vercel)] ──► [Supabase: PostgreSQL + Auth + RLS + Storage + Edge Functions]
        │                          │
   desktop/celular            backups automáticos (PITR), réplicas gerenciadas
```

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui; **PWA** (manifest + service worker) para uso no celular; formulários com react-hook-form + zod; gráficos com Recharts.
- **Backend**: Supabase — PostgreSQL com **Row Level Security**, Auth (e-mail/senha + convites), API PostgREST tipada (supabase-js), Views/Functions SQL para os indicadores calculados.
- **Alta disponibilidade**: Vercel (edge/CDN, multi-região) + Supabase gerenciado (backups diários + point-in-time recovery no plano Pro). Sem servidor para administrar.
- **LGPD**: pacientes identificados apenas por iniciais + nº de registro/prontuário (como hoje); RLS por papel; log de auditoria.

### 2.1 Modelo de dados (esquema único, multi-serviço)

Núcleo dimensional (resolve os problemas de qualidade na raiz):
- `services` — fisioterapia, terapia_ocupacional, psicologia, fonoaudiologia, assistencia_social (seed)
- `sectors` — nome, tipo (médica/ortopédica/cirúrgica), contexto (uti/enfermaria/clinica/ambulatorio), serviços habilitados (seed a partir da aba "Setores")
- `collaborators` — nome canônico, serviço, vínculo com `auth.users`, ativo/inativo (dropdown, nunca texto livre)
- `patients` — iniciais, nº registro/prontuário, idade (dados mínimos, LGPD)

Coleta de produção (substitui as abas de produção):
- `production_records` — id, service_id, date, shift, sector_id, collaborator_id, created_by, timestamps (UNIQUE service+date+shift+sector+collaborator)
- `production_values` — record_id, indicator_id, value numeric
- `indicators` — catálogo do §1 como dados: code, nome, serviço, contexto (geral/uti/enfermaria/ambulatorio), tipo (contagem/taxa), ordem, ativo. Adicionar indicador novo = INSERT, sem migração.

Escalas (substitui MRC/Barthel/Melhoria Funcional):
- `scale_assessments` — id, scale_type (barthel|mrc|melhoria_uti), patient_id, collaborator_id, date, moment (entrada|saida), sector_id, attendance_number, cid, observações
- `scale_scores` — assessment_id, item_code, option_value (o item escolhido), points
- `scale_items` + `scale_item_options` — definição das escalas como dados (10 itens Barthel com suas opções/pontos; 12 músculos MRC com graus 0–5; 4 componentes Melhoria UTI)
- Total e flag de melhora **calculados** (view/função comparando saída vs. entrada do mesmo paciente/internação), nunca digitados.

### 2.2 Telas (MVP)
1. Login + gestão de usuários (admin convida colaboradores; papéis: admin, coordenador, colaborador)
2. Lançamento diário de produção — Fisioterapia (mobile-first, dropdowns, validação zod, rascunho offline básico)
3. Avaliação Barthel (wizard 10 itens, total em tempo real)
4. Avaliação MRC (grid 12 músculos E/D, total 0–60)
5. Avaliação Melhoria Funcional UTI
6. Dashboard de indicadores — filtros por período/setor/turno/colaborador; cartões de KPI, séries temporais, comparativo entrada×saída das escalas, % de melhora; export CSV/Excel
7. Administração — catálogos (setores, colaboradores, indicadores)

### 2.3 Fases
- **Fase 1 (MVP)**: infra + auth + catálogos + Fisioterapia + 3 escalas + dashboard + importação do histórico
- **Fase 2**: Terapia Ocupacional (3 contextos), Fonoaudiologia
- **Fase 3**: Psicologia (geral + UTI), Assistência Social
- **Fase 4**: refinamentos (metas/limiares por indicador, relatórios PDF mensais, auditoria completa)

Como o modelo é dirigido a dados (`indicators`), as fases 2–3 são majoritariamente seeds + formulário genérico de produção.

### 2.4 Importação do histórico (~70 mil registros)
Script Node/TypeScript (`scripts/import-xlsx.ts`) lendo o .xlsx (SheetJS):
1. Normalizar datas: serial Excel → ISO; texto BR dd/mm/aaaa → ISO; anos absurdos (0202, 0224) corrigidos por heurística (0224→2024 etc.) ou marcados para revisão
2. Normalizar colaboradores: trim/casefold + tabela de sinônimos → `collaborators`; nomes compostos ("EVELYN/ NATALIA") viram registro próprio ou split — decidir na execução com relatório
3. Mapear setores para `sectors`; valores "-"/vazios → NULL; ignorar `#DIV/0!` (taxas serão recalculadas)
4. Escalas: texto da opção ("Grau 4: …", "10 - Independente") → `scale_item_options` por matching; recalcular totais e flags de melhora
5. Saída: relatório de importação (linhas ok / corrigidas / rejeitadas com motivo) para validação da MaisFisio

## 3. Estrutura do repositório (a criar)

```
mais-fisio-web/
├── app/                  # Next.js App Router (rotas: /login, /lancamento, /escalas/*, /dashboard, /admin)
├── components/           # shadcn/ui + componentes de formulário/gráfico
├── lib/supabase/         # clients (server/browser), tipos gerados
├── supabase/
│   ├── migrations/       # SQL: tabelas §2.1, RLS, views de indicadores
│   └── seed.sql          # serviços, setores, indicadores, escalas (itens/opções do §1)
├── scripts/import-xlsx.ts
└── docs/indicadores.md   # catálogo §1 versionado
```

## 4. Verificação
1. `npm run dev` → fluxo completo no navegador (desktop + viewport mobile): login → lançar produção Fisio → criar Barthel entrada/saída do mesmo paciente → conferir flag de melhora e total no dashboard
2. Conferência da importação: totais por aba (planilha) × contagens no banco (ex.: Barthel ~17.052 avaliações, MRC ~17.909, Fisio ~8.051 lançamentos) + relatório de rejeitados
3. Validar 3 pacientes reais: pontuação Barthel/MRC do sistema × planilha
4. Testes de RLS: colaborador não enxerga administração; visitante anônimo não lê nada
5. Lighthouse PWA ≥ 90 em mobile

## 5. Fora de escopo (registrar para depois)
- Integração com prontuário eletrônico do hospital
- App nativo (PWA cobre o celular)
- Substituir o B.I. existente (dashboard interno cobre; export CSV alimenta o B.I. se quiserem manter)
