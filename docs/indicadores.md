# Catálogo de Indicadores e Escalas — MaisFisio / Hospital Público Estadual Galileu

> Fonte: `Hospital Público Estadual Galileu - Produção Assistencial.xlsx` (16 abas, ~70 mil registros desde 2023).
> Este catálogo é a fonte de verdade para o `supabase/seed.sql` (tabelas `services`, `sectors`, `indicators`, `scale_items`, `scale_item_options`).

## Dimensões comuns (todas as abas de produção)

| Dimensão | Valores |
|---|---|
| DATA | data do lançamento |
| COLABORADOR(A) | profissional responsável (no sistema: dropdown de `collaborators`) |
| TURNO | MANHÃ / TARDE / NOITE |
| SETOR | ver tabela abaixo |
| TIPO DE SETOR | Médica / Ortopédica / Cirúrgica |

### Setores (aba oculta "Setores")

| Serviço | Setores |
|---|---|
| Fisioterapia | UTI, Enfermaria Azul, Enfermaria Laranja, Enfermaria Amarela, Enfermaria Verde |
| Demais serviços | Clinica Verde, Clinica Amarela, Clinica Laranja, Clinica Azul, UTI, Ambulatório |

---

## 1. Fisioterapia (aba "Fisioterapia", ~8.051 lançamentos)

| # | Indicador | Tipo |
|---|---|---|
| 1 | Pacientes Internados | contagem |
| 2 | Pacientes Prescritos | contagem |
| 3 | Taxa de pacientes captados pela Fisioterapia nas unidades de internação | taxa |
| 4 | Altas | contagem |
| 5 | Intubações | contagem |
| 6 | Número de quedas da fisioterapia | contagem |
| 7 | Taxa de efetividade nas Extubações Programadas | taxa |
| 8 | Óbitos | contagem |
| 9 | PCR | contagem |
| 10 | Taxa de Fisioterapia Respiratória realizada durante a Fisioterapia | taxa |
| 11 | Taxa de Fisioterapia Motora realizada durante a fisioterapia | taxa |
| 12 | Número de paciente-dia com via aérea artificial | contagem |
| 13 | Taxa de pacientes com via aérea artificial que precisaram ser aspirados | taxa |
| 14 | Número de pacientes atendidos com expectativa de chegar à sedestação | contagem |
| 15 | Taxa de Sedestações realizadas durante a Fisioterapia | taxa |
| 16 | Número de pacientes atendidos com expectativa de chegar ao ortostatismo | contagem |
| 17 | Taxa de Ortostatismo realizado durante a Fisioterapia | taxa |
| 18 | Taxa de Deambulação realizada durante a Fisioterapia | taxa |
| 19 | Pronação | contagem |
| 20 | Número de pacientes que usam a oxigenoterapia | contagem |
| 21 | Visita Multidisciplinar | contagem |
| 22 | Taxa de Ventilação Não Invasiva (VNI) realizada pela Fisioterapia | taxa |
| 23 | Taxa de Ventilação Mecânica Invasiva realizada pela Fisioterapia | taxa |
| 24 | Traqueostomia | contagem |
| 25 | Número de pacientes atendidos pela fisioterapia que não deambulavam | contagem |

## 2. Terapia Ocupacional (3 contextos)

### 2.1 Atendimento geral (aba "Terapia Ocupacional - Atendimen", ~4.079 lançamentos)
Visita Multidisciplinar · Palestra Educação em Saúde · Treinamento · Totais de Atendimentos Realizados · Órtese de Descompressão · Órtese de Posicionamento · Prótese

### 2.2 Enfermaria (aba "Terapia Ocupacional - Enfermari", ~4.131 lançamentos)
Atendimentos realizados nas clínicas · Atendimento ao Familiar · Visita Multidisciplinar · Atividade em Grupo · Altas da enfermaria · Adesões ao plano Terapêutico · Pacientes com efetividade na diminuição da dor · Pacientes de alta com orientação da T.O. · Totais de Atendimentos Realizados · Órtese de Descompressão · Órtese de Posicionamento · Prótese · Tópicos de Interconsultas (texto)

### 2.3 Ambulatório (aba "Terapia Ocupacional - Ambulató", ~991 lançamentos, cabeçalho na linha 2)
Interconsultas · Atendimentos em Grupo · Atendimento Individualizado · Adesão ao plano terapêutico ambulatório · Altas do ambulatório · Usuários com efetividade na diminuição da dor no ambulatório · Número de pacientes com efetividade na diminuição da dor · Taxa de usuários de ganho funcional · Totais de Atendimentos Realizados · Órtese de Descompressão · Órtese de Posicionamento · Prótese

## 3. Psicologia (2 contextos)

### 3.1 Geral (aba "Psicologia - 2026", ~10.093 lançamentos; existe cópia oculta " Psicologia - 2026")
Atendimentos Realizados · Admissões · Critério de Elegibilidade Admissão · Acompanhamento Psicológico · Visita Especial · Encaminhamento Externo · Interconsulta · Visita Multidisciplinar · Atendimento Familiar · Protocolo Risco de Suicídio · Número de usuários avaliados · Acolhimento familiar em situação de óbito

### 3.2 UTI (aba "Psicologia UTI", ~1.014 lançamentos, cabeçalho na linha 2)
Atendimentos Realizados · Admissões · Acompanhamento Psicológico · Encaminhamento Externo · Acolhimento Familiar em situação de óbito · Atendimento Familiar · Visita Multidisciplinar · Protocolo Risco de Suicídio

## 4. Fonoaudiologia (aba "Fonoaudiologia", ~3.996 lançamentos)
Atendimentos Realizados · Atendimento Familiar · Visita Multidisciplinar · Interconsulta · Broncoaspirações · Pacientes com Melhorias na Fonoterapia · Altas da Fono · **Índice de melhoria = Melhorias ÷ Altas** (calcular no banco com proteção contra divisão por zero — na planilha gera `#DIV/0!`)

## 5. Assistência Social (aba "Assistência Social", ~11.098 lançamentos)
Atendimentos Realizados · Acolhimento · Ambulatório admissão · Orientação de TFD Unidades · Acionamento Familiar · Acionamento à rede externa · Visita Multidisciplinar · Alta hospitalar/Alta programada · Pacientes avaliados pelo serviço social · Pacientes com permanência ≥ 6h após a alta médica · Usuários internados sem suporte total ou parcial sociofamiliar · Evasões · Acompanhamentos do Serviço Social/Psicologia · Acionamentos médicos por tentativas de evasão · Acionamento de transporte social · Acolhimento familiar em situação de óbito

---

## 6. Escala de Barthel (aba "Escala de Barthel", ~17.052 avaliações)

Campos da avaliação: DATA · PACIENTE (iniciais) · REGISTRO · Entrada/Saída · SETOR · 10 itens abaixo · Pontuação total (0–100, **calculada**) · Melhora? (**calculada**: total de saída > total de entrada do mesmo paciente/registro).

Textos e pontos exatos (usar como `scale_item_options`):

| Item | Opções (texto exato → pontos) |
|---|---|
| ALIMENTAÇÃO | 0 - Incapacitado → 0 · 5 - Precisa de ajuda para cortar, passar manteiga, etc, ou dieta modificada → 5 · 10 - Independente → 10 |
| BANHO | 0 - Incapacitado → 0 · 3 - Ajuda Parcial → 3 · 5 - Independente (Ou no chuveiro) → 5 |
| HIGIENE PESSOAL | 0 - precisa de ajuda com a higiene pessoal → 0 · 5 - Independente → 5 |
| VESTIR | 0 - dependente → 0 · 5 - precisa de ajuda mas consegue fazer uma parte sozinho → 5 · 10 - independente (incluindo botões, zipers, laços, etc.) → 10 |
| INTESTINO | 0 - incontinente (necessidade de enemas) → 0 · 5 - acidente ocasional → 5 · 10 - continente → 10 |
| SISTEMA URINÁRIO | 0 - incontinente, ou cateterizado e incapaz de manejo → 0 · 5 - acidente ocasional → 5 · 10 - continente → 10 |
| USO DO TOILET | 0 - dependente → 0 · 5 - precisa de alguma ajuda parcial → 5 · 10 - independente (pentear-se, limpar-se) → 10 |
| TRANSFERÊNCIA | 0 - incapacitado, sem equilíbrio para ficar sentado → 0 · 5 - muita ajuda (uma ou duas pessoas, física), pode sentar → 5 · 10 - pouca ajuda (verbal ou física) → 10 · 15 - independente → 15 |
| MOBILIDADE | 0 - imóvel ou < 50 metros → 0 · 5 - cadeira de rodas independente, incluindo esquinas, > 50 metros → 5 · 10 - caminha com a ajuda de uma pessoa (verbal ou física) > 50 metros → 10 · 15 - independente (mas pode precisar de alguma ajuda; ex.: bengala) > 50 metros → 15 |
| ESCADAS | 0 - incapacitado → 0 · 5 - precisa de ajuda (verbal, física, ou ser carregado) → 5 · 10 - independente → 10 |

Interpretação usual do total: 0–20 dependência total · 21–60 dependência severa · 61–90 dependência moderada · 91–99 dependência leve · 100 independente.

## 7. Escala MRC (aba "MRC - TABELA", ~17.909 avaliações)

Campos: DATA · COLABORADOR · INICIAIS DO PACIENTE · Número do atendimento · ENTRADA OU SAÍDA · Setor · Tipo do Setor · 12 grupos musculares · Pontuação total (0–60, **calculada**) · Apresentou Melhora? (**calculada**).

12 grupos musculares (cada um Esquerdo e Direito):
1. Abdutores de ombro (E/D)
2. Flexores de cotovelo (E/D)
3. Extensores de pulso (E/D)
4. Flexores do quadril (E/D)
5. Extensores de joelho (E/D)
6. Dorsiflexores do pé (E/D)

Graus (texto exato → pontos):
- Grau 0: Sem contração visível → 0
- Grau 1: Contração visível sem movimento do membro (não existente para flexão do quadril) → 1
- Grau 2: Movimento do membro, mas não contra a gravidade → 2
- Grau 3: Movimento contra a gravidade em (quase) toda a extensão → 3
- Grau 4: Movimento contra a gravidade e resistência → 4
- Grau 5: Normal → 5

Total 0–60. Ponto de corte clínico usual: < 48 indica fraqueza adquirida na UTI (ICU-AW).

## 8. Melhoria Funcional da UTI (aba "Melhoria Funcional da UTI - Tab", ~1.085 avaliações)

Campos: Data da Avaliação · Paciente (sigla) · Nº do prontuário · Idade · Diagnóstico principal (CID) · Tipo do Setor · Entrada/Saída · Data de entrada/saída na UTI · 4 componentes abaixo · Observações · Pontuação total (soma, máx. 33, **calculada**) · Melhoria? (**calculada**).

| Componente | Opções (texto exato → pontos) |
|---|---|
| Escala de Coma de Glasgow | 3 - Coma profundo → 3 · 7 - Estado de consciência alterado → 7 · 15 - Totalmente alerta → 15 |
| Melhoria da Força Muscular | 0 - Ausência de movimento → 0 · 1 - Contração muscular perceptível → 1 · 2 - Movimento ativo, não contra gravidade → 2 · 3 - Movimento ativo contra a gravidade → 3 · 4 - Movimento ativo contra a resistência → 4 · 5 - Força muscular normal → 5 |
| Capacidade de Respiração | Ventilação mecânica → 1 · Oxigênio suplementar → 2 · Respiração espontânea sem oxigênio → 3 |
| Escala de Mobilidade | 0 - Imobilidade total → 0 · 1 - Mobilidade limitada na cama → 1 · 2 - Mobilidade limitada na cama → 2 · 3 - Mobilidade limitada na cama → 3 · 4 - Mobilidade na cama e sentado na cadeira → 4 · 5 → 5 · 6 → 6 · 7 - Mobilidade na cama, sentado na cadeira e em pé → 7 · 8 → 8 · 9 → 9 · 10 - Mobilidade completa → 10 |

## 9. Problemas de qualidade na planilha (a importação deve tratar)

1. **Datas mistas**: seriais Excel (ex.: `45175` = 06/09/2023) e texto digitado com anos errados (`21/03/0202`, `09/03/0204`, `23/08/0224` → provavelmente 2022/2024/2024). Corrigir por heurística e marcar para revisão.
2. **Colaboradores em texto livre**: `DANILO SOUZA` vs `danilo souza`, espaços extras, duplas (`EVELYN/ NATALIA`, `Izana/Shirlene`). Normalizar via tabela de sinônimos.
3. **Fórmulas quebradas**: `#DIV/0!` no índice de melhoria da Fono; colunas PONTUAÇÃO1..10 do Barthel parcialmente preenchidas. Ignorar e recalcular no banco.
4. **Valores não numéricos** em campos numéricos: `-`, vazios → NULL.
5. **Setor vazio** em muitas linhas da T.O. Ambulatório → aceitar NULL para dados históricos; obrigatório no sistema novo.
6. **Abas duplicadas/ocultas**: " Psicologia - 2026" (oculta) duplica "Psicologia - 2026"; "Respostas ao formulário 1/2" (ocultas) são a origem bruta de MRC e Melhoria UTI — importar apenas as abas consolidadas visíveis.
