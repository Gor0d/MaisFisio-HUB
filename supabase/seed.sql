-- Catálogos oficiais do MaisFisio. Seguro para reaplicação em ambientes locais.
begin;

insert into public.services (code, name) values
  ('fisioterapia', 'Fisioterapia'),
  ('terapia_ocupacional', 'Terapia Ocupacional'),
  ('psicologia', 'Psicologia'),
  ('fonoaudiologia', 'Fonoaudiologia'),
  ('assistencia_social', 'Assistência Social')
on conflict (code) do update set name = excluded.name, active = true;

insert into public.sectors (code, name, context) values
  ('uti', 'UTI', 'uti'),
  ('enfermaria_azul', 'Enfermaria Azul', 'enfermaria'),
  ('enfermaria_laranja', 'Enfermaria Laranja', 'enfermaria'),
  ('enfermaria_amarela', 'Enfermaria Amarela', 'enfermaria'),
  ('enfermaria_verde', 'Enfermaria Verde', 'enfermaria'),
  ('clinica_verde', 'Clínica Verde', 'clinica'),
  ('clinica_amarela', 'Clínica Amarela', 'clinica'),
  ('clinica_laranja', 'Clínica Laranja', 'clinica'),
  ('clinica_azul', 'Clínica Azul', 'clinica'),
  ('ambulatorio', 'Ambulatório', 'ambulatorio')
on conflict (code) do update set name = excluded.name, context = excluded.context, active = true;

insert into public.service_sectors (service_id, sector_id)
select s.id, x.id
from public.services s
join public.sectors x on (
  (s.code = 'fisioterapia' and x.code in ('uti', 'enfermaria_azul', 'enfermaria_laranja', 'enfermaria_amarela', 'enfermaria_verde'))
  or (s.code <> 'fisioterapia' and x.code in ('uti', 'clinica_verde', 'clinica_amarela', 'clinica_laranja', 'clinica_azul', 'ambulatorio'))
)
on conflict do nothing;

with service as (select id from public.services where code = 'fisioterapia')
insert into public.indicators (service_id, code, name, context, kind, display_order)
select service.id, v.code, v.name, 'geral', v.kind::public.indicator_kind, v.ord
from service cross join (values
  ('fisio_pacientes_internados', 'Pacientes Internados', 'contagem', 1),
  ('fisio_pacientes_prescritos', 'Pacientes Prescritos', 'contagem', 2),
  ('fisio_taxa_captados', 'Taxa de pacientes captados pela Fisioterapia nas unidades de internação', 'taxa', 3),
  ('fisio_altas', 'Altas', 'contagem', 4),
  ('fisio_intubacoes', 'Intubações', 'contagem', 5),
  ('fisio_quedas', 'Número de quedas da fisioterapia', 'contagem', 6),
  ('fisio_taxa_extubacoes', 'Taxa de efetividade nas Extubações Programadas', 'taxa', 7),
  ('fisio_obitos', 'Óbitos', 'contagem', 8),
  ('fisio_pcr', 'PCR', 'contagem', 9),
  ('fisio_taxa_respiratoria', 'Taxa de Fisioterapia Respiratória realizada durante a Fisioterapia', 'taxa', 10),
  ('fisio_taxa_motora', 'Taxa de Fisioterapia Motora realizada durante a Fisioterapia', 'taxa', 11),
  ('fisio_paciente_dia_via_aerea', 'Número de paciente-dia com via aérea artificial', 'contagem', 12),
  ('fisio_taxa_aspirados', 'Taxa de pacientes com via aérea artificial que precisaram ser aspirados', 'taxa', 13),
  ('fisio_expectativa_sedestacao', 'Número de pacientes atendidos com expectativa de chegar à sedestação', 'contagem', 14),
  ('fisio_taxa_sedestacoes', 'Taxa de Sedestações realizadas durante a Fisioterapia', 'taxa', 15),
  ('fisio_expectativa_ortostatismo', 'Número de pacientes atendidos com expectativa de chegar ao ortostatismo', 'contagem', 16),
  ('fisio_taxa_ortostatismo', 'Taxa de Ortostatismo realizado durante a Fisioterapia', 'taxa', 17),
  ('fisio_taxa_deambulacao', 'Taxa de Deambulação realizada durante a Fisioterapia', 'taxa', 18),
  ('fisio_pronacao', 'Pronação', 'contagem', 19),
  ('fisio_oxigenoterapia', 'Número de pacientes que usam a oxigenoterapia', 'contagem', 20),
  ('fisio_visita_multidisciplinar', 'Visita Multidisciplinar', 'contagem', 21),
  ('fisio_taxa_vni', 'Taxa de Ventilação Não Invasiva (VNI) realizada pela Fisioterapia', 'taxa', 22),
  ('fisio_taxa_vm_invasiva', 'Taxa de Ventilação Mecânica Invasiva realizada pela Fisioterapia', 'taxa', 23),
  ('fisio_traqueostomia', 'Traqueostomia', 'contagem', 24),
  ('fisio_nao_deambulavam', 'Número de pacientes atendidos pela fisioterapia que não deambulavam', 'contagem', 25)
) as v(code, name, kind, ord)
on conflict (code) do update set name = excluded.name, kind = excluded.kind, display_order = excluded.display_order, active = true;

with service as (select id from public.services where code = 'terapia_ocupacional')
insert into public.indicators (service_id, code, name, context, kind, display_order)
select service.id, v.code, v.name, v.context, v.kind::public.indicator_kind, v.ord
from service cross join (values
  ('to_geral_visita_multi', 'Visita Multidisciplinar', 'geral', 'contagem', 1),
  ('to_geral_palestra', 'Palestra Educação em Saúde', 'geral', 'contagem', 2),
  ('to_geral_treinamento', 'Treinamento', 'geral', 'contagem', 3),
  ('to_geral_total', 'Totais de Atendimentos Realizados', 'geral', 'contagem', 4),
  ('to_geral_ortese_descompressao', 'Órtese de Descompressão', 'geral', 'contagem', 5),
  ('to_geral_ortese_posicionamento', 'Órtese de Posicionamento', 'geral', 'contagem', 6),
  ('to_geral_protese', 'Prótese', 'geral', 'contagem', 7),
  ('to_enf_atendimentos', 'Atendimentos realizados nas clínicas', 'enfermaria', 'contagem', 1),
  ('to_enf_familiar', 'Atendimento ao Familiar', 'enfermaria', 'contagem', 2),
  ('to_enf_visita_multi', 'Visita Multidisciplinar', 'enfermaria', 'contagem', 3),
  ('to_enf_grupo', 'Atividade em Grupo', 'enfermaria', 'contagem', 4),
  ('to_enf_altas', 'Altas da enfermaria', 'enfermaria', 'contagem', 5),
  ('to_enf_adesoes', 'Adesões ao plano Terapêutico', 'enfermaria', 'contagem', 6),
  ('to_enf_dor', 'Pacientes com efetividade na diminuição da dor', 'enfermaria', 'contagem', 7),
  ('to_enf_altas_orientadas', 'Pacientes de alta com orientação da T.O.', 'enfermaria', 'contagem', 8),
  ('to_enf_total', 'Totais de Atendimentos Realizados', 'enfermaria', 'contagem', 9),
  ('to_enf_ortese_descompressao', 'Órtese de Descompressão', 'enfermaria', 'contagem', 10),
  ('to_enf_ortese_posicionamento', 'Órtese de Posicionamento', 'enfermaria', 'contagem', 11),
  ('to_enf_protese', 'Prótese', 'enfermaria', 'contagem', 12),
  ('to_enf_interconsultas', 'Tópicos de Interconsultas', 'enfermaria', 'texto', 13),
  ('to_amb_interconsultas', 'Interconsultas', 'ambulatorio', 'contagem', 1),
  ('to_amb_grupo', 'Atendimentos em Grupo', 'ambulatorio', 'contagem', 2),
  ('to_amb_individual', 'Atendimento Individualizado', 'ambulatorio', 'contagem', 3),
  ('to_amb_adesao', 'Adesão ao plano terapêutico ambulatório', 'ambulatorio', 'contagem', 4),
  ('to_amb_altas', 'Altas do ambulatório', 'ambulatorio', 'contagem', 5),
  ('to_amb_dor_usuarios', 'Usuários com efetividade na diminuição da dor no ambulatório', 'ambulatorio', 'contagem', 6),
  ('to_amb_dor_pacientes', 'Número de pacientes com efetividade na diminuição da dor', 'ambulatorio', 'contagem', 7),
  ('to_amb_taxa_ganho', 'Taxa de usuários de ganho funcional', 'ambulatorio', 'taxa', 8),
  ('to_amb_total', 'Totais de Atendimentos Realizados', 'ambulatorio', 'contagem', 9),
  ('to_amb_ortese_descompressao', 'Órtese de Descompressão', 'ambulatorio', 'contagem', 10),
  ('to_amb_ortese_posicionamento', 'Órtese de Posicionamento', 'ambulatorio', 'contagem', 11),
  ('to_amb_protese', 'Prótese', 'ambulatorio', 'contagem', 12)
) as v(code, name, context, kind, ord)
on conflict (code) do update set name = excluded.name, context = excluded.context, kind = excluded.kind, display_order = excluded.display_order, active = true;

with service as (select id from public.services where code = 'psicologia')
insert into public.indicators (service_id, code, name, context, kind, display_order)
select service.id, v.code, v.name, v.context, 'contagem'::public.indicator_kind, v.ord
from service cross join (values
  ('psi_atendimentos', 'Atendimentos Realizados', 'geral', 1),
  ('psi_admissoes', 'Admissões', 'geral', 2),
  ('psi_elegibilidade', 'Critério de Elegibilidade Admissão', 'geral', 3),
  ('psi_acompanhamento', 'Acompanhamento Psicológico', 'geral', 4),
  ('psi_visita_especial', 'Visita Especial', 'geral', 5),
  ('psi_encaminhamento', 'Encaminhamento Externo', 'geral', 6),
  ('psi_interconsulta', 'Interconsulta', 'geral', 7),
  ('psi_visita_multi', 'Visita Multidisciplinar', 'geral', 8),
  ('psi_familiar', 'Atendimento Familiar', 'geral', 9),
  ('psi_risco_suicidio', 'Protocolo Risco de Suicídio', 'geral', 10),
  ('psi_avaliados', 'Número de usuários avaliados', 'geral', 11),
  ('psi_acolhimento_obito', 'Acolhimento familiar em situação de óbito', 'geral', 12),
  ('psi_uti_atendimentos', 'Atendimentos Realizados', 'uti', 1),
  ('psi_uti_admissoes', 'Admissões', 'uti', 2),
  ('psi_uti_acompanhamento', 'Acompanhamento Psicológico', 'uti', 3),
  ('psi_uti_encaminhamento', 'Encaminhamento Externo', 'uti', 4),
  ('psi_uti_acolhimento_obito', 'Acolhimento Familiar em situação de óbito', 'uti', 5),
  ('psi_uti_familiar', 'Atendimento Familiar', 'uti', 6),
  ('psi_uti_visita_multi', 'Visita Multidisciplinar', 'uti', 7),
  ('psi_uti_risco_suicidio', 'Protocolo Risco de Suicídio', 'uti', 8)
) as v(code, name, context, ord)
on conflict (code) do update set name = excluded.name, context = excluded.context, display_order = excluded.display_order, active = true;

with service as (select id from public.services where code = 'fonoaudiologia')
insert into public.indicators (service_id, code, name, context, kind, display_order)
select service.id, v.code, v.name, 'geral', v.kind::public.indicator_kind, v.ord
from service cross join (values
  ('fono_atendimentos', 'Atendimentos Realizados', 'contagem', 1),
  ('fono_familiar', 'Atendimento Familiar', 'contagem', 2),
  ('fono_visita_multi', 'Visita Multidisciplinar', 'contagem', 3),
  ('fono_interconsulta', 'Interconsulta', 'contagem', 4),
  ('fono_broncoaspiracoes', 'Broncoaspirações', 'contagem', 5),
  ('fono_melhorias', 'Pacientes com Melhorias na Fonoterapia', 'contagem', 6),
  ('fono_altas', 'Altas da Fono', 'contagem', 7),
  ('fono_indice_melhoria', 'Índice de melhoria da Fono', 'taxa', 8)
) as v(code, name, kind, ord)
on conflict (code) do update set name = excluded.name, kind = excluded.kind, display_order = excluded.display_order, active = true;

update public.indicators derived
set derived = true,
    numerator_indicator_id = numerator.id,
    denominator_indicator_id = denominator.id,
    unit = '%'
from public.indicators numerator, public.indicators denominator
where derived.code = 'fono_indice_melhoria'
  and numerator.code = 'fono_melhorias'
  and denominator.code = 'fono_altas';

with service as (select id from public.services where code = 'assistencia_social')
insert into public.indicators (service_id, code, name, context, kind, display_order)
select service.id, v.code, v.name, 'geral', 'contagem'::public.indicator_kind, v.ord
from service cross join (values
  ('social_atendimentos', 'Atendimentos Realizados', 1),
  ('social_acolhimento', 'Acolhimento', 2),
  ('social_ambulatorio_admissao', 'Ambulatório admissão', 3),
  ('social_tfd', 'Orientação de TFD Unidades', 4),
  ('social_acionamento_familiar', 'Acionamento Familiar', 5),
  ('social_rede_externa', 'Acionamento à rede externa', 6),
  ('social_visita_multi', 'Visita Multidisciplinar', 7),
  ('social_alta', 'Alta hospitalar/Alta programada', 8),
  ('social_avaliados', 'Pacientes avaliados pelo serviço social', 9),
  ('social_permanencia_pos_alta', 'Pacientes com permanência ≥ 6h após a alta médica', 10),
  ('social_sem_suporte', 'Usuários internados sem suporte total ou parcial sociofamiliar', 11),
  ('social_evasoes', 'Evasões', 12),
  ('social_acompanhamentos', 'Acompanhamentos do Serviço Social/Psicologia', 13),
  ('social_acionamentos_evasao', 'Acionamentos médicos por tentativas de evasão', 14),
  ('social_transporte', 'Acionamento de transporte social', 15),
  ('social_acolhimento_obito', 'Acolhimento familiar em situação de óbito', 16)
) as v(code, name, ord)
on conflict (code) do update set name = excluded.name, display_order = excluded.display_order, active = true;

insert into public.scale_items (scale_type, code, name, display_order, max_points) values
  ('barthel', 'alimentacao', 'Alimentação', 1, 10),
  ('barthel', 'banho', 'Banho', 2, 5),
  ('barthel', 'higiene_pessoal', 'Higiene Pessoal', 3, 5),
  ('barthel', 'vestir', 'Vestir', 4, 10),
  ('barthel', 'intestino', 'Intestino', 5, 10),
  ('barthel', 'sistema_urinario', 'Sistema Urinário', 6, 10),
  ('barthel', 'uso_toilet', 'Uso do Toilet', 7, 10),
  ('barthel', 'transferencia', 'Transferência', 8, 15),
  ('barthel', 'mobilidade', 'Mobilidade', 9, 15),
  ('barthel', 'escadas', 'Escadas', 10, 10),
  ('mrc', 'ombro_e', 'Abdutores de ombro — Esquerdo', 1, 5),
  ('mrc', 'ombro_d', 'Abdutores de ombro — Direito', 2, 5),
  ('mrc', 'cotovelo_e', 'Flexores de cotovelo — Esquerdo', 3, 5),
  ('mrc', 'cotovelo_d', 'Flexores de cotovelo — Direito', 4, 5),
  ('mrc', 'pulso_e', 'Extensores de pulso — Esquerdo', 5, 5),
  ('mrc', 'pulso_d', 'Extensores de pulso — Direito', 6, 5),
  ('mrc', 'quadril_e', 'Flexores do quadril — Esquerdo', 7, 5),
  ('mrc', 'quadril_d', 'Flexores do quadril — Direito', 8, 5),
  ('mrc', 'joelho_e', 'Extensores de joelho — Esquerdo', 9, 5),
  ('mrc', 'joelho_d', 'Extensores de joelho — Direito', 10, 5),
  ('mrc', 'pe_e', 'Dorsiflexores do pé — Esquerdo', 11, 5),
  ('mrc', 'pe_d', 'Dorsiflexores do pé — Direito', 12, 5),
  ('melhoria_uti', 'glasgow', 'Escala de Coma de Glasgow', 1, 15),
  ('melhoria_uti', 'forca_muscular', 'Melhoria da Força Muscular', 2, 5),
  ('melhoria_uti', 'respiracao', 'Capacidade de Respiração', 3, 3),
  ('melhoria_uti', 'mobilidade', 'Escala de Mobilidade', 4, 10)
on conflict (scale_type, code) do update set name = excluded.name, display_order = excluded.display_order, max_points = excluded.max_points;

with options(scale_type, item_code, label, points, ord) as (values
  ('barthel', 'alimentacao', '0 - Incapacitado', 0, 1),
  ('barthel', 'alimentacao', '5 - Precisa de ajuda para cortar, passar manteiga, etc, ou dieta modificada', 5, 2),
  ('barthel', 'alimentacao', '10 - Independente', 10, 3),
  ('barthel', 'banho', '0 - Incapacitado', 0, 1), ('barthel', 'banho', '3 - Ajuda Parcial', 3, 2), ('barthel', 'banho', '5 - Independente (Ou no chuveiro)', 5, 3),
  ('barthel', 'higiene_pessoal', '0 - precisa de ajuda com a higiene pessoal', 0, 1), ('barthel', 'higiene_pessoal', '5 - Independente', 5, 2),
  ('barthel', 'vestir', '0 - dependente', 0, 1), ('barthel', 'vestir', '5 - precisa de ajuda mas consegue fazer uma parte sozinho', 5, 2), ('barthel', 'vestir', '10 - independente (incluindo botões, zipers, laços, etc.)', 10, 3),
  ('barthel', 'intestino', '0 - incontinente (necessidade de enemas)', 0, 1), ('barthel', 'intestino', '5 - acidente ocasional', 5, 2), ('barthel', 'intestino', '10 - continente', 10, 3),
  ('barthel', 'sistema_urinario', '0 - incontinente, ou cateterizado e incapaz de manejo', 0, 1), ('barthel', 'sistema_urinario', '5 - acidente ocasional', 5, 2), ('barthel', 'sistema_urinario', '10 - continente', 10, 3),
  ('barthel', 'uso_toilet', '0 - dependente', 0, 1), ('barthel', 'uso_toilet', '5 - precisa de alguma ajuda parcial', 5, 2), ('barthel', 'uso_toilet', '10 - independente (pentear-se, limpar-se)', 10, 3),
  ('barthel', 'transferencia', '0 - incapacitado, sem equilíbrio para ficar sentado', 0, 1), ('barthel', 'transferencia', '5 - muita ajuda (uma ou duas pessoas, física), pode sentar', 5, 2), ('barthel', 'transferencia', '10 - pouca ajuda (verbal ou física)', 10, 3), ('barthel', 'transferencia', '15 - independente', 15, 4),
  ('barthel', 'mobilidade', '0 - imóvel ou < 50 metros', 0, 1), ('barthel', 'mobilidade', '5 - cadeira de rodas independente, incluindo esquinas, > 50 metros', 5, 2), ('barthel', 'mobilidade', '10 - caminha com a ajuda de uma pessoa (verbal ou física) > 50 metros', 10, 3), ('barthel', 'mobilidade', '15 - independente (mas pode precisar de alguma ajuda; ex.: bengala) > 50 metros', 15, 4),
  ('barthel', 'escadas', '0 - incapacitado', 0, 1), ('barthel', 'escadas', '5 - precisa de ajuda (verbal, física, ou ser carregado)', 5, 2), ('barthel', 'escadas', '10 - independente', 10, 3),
  ('melhoria_uti', 'glasgow', '3 - Coma profundo', 3, 1), ('melhoria_uti', 'glasgow', '7 - Estado de consciência alterado', 7, 2), ('melhoria_uti', 'glasgow', '15 - Totalmente alerta', 15, 3),
  ('melhoria_uti', 'forca_muscular', '0 - Ausência de movimento', 0, 1), ('melhoria_uti', 'forca_muscular', '1 - Contração muscular perceptível', 1, 2), ('melhoria_uti', 'forca_muscular', '2 - Movimento ativo, não contra gravidade', 2, 3), ('melhoria_uti', 'forca_muscular', '3 - Movimento ativo contra a gravidade', 3, 4), ('melhoria_uti', 'forca_muscular', '4 - Movimento ativo contra a resistência', 4, 5), ('melhoria_uti', 'forca_muscular', '5 - Força muscular normal', 5, 6),
  ('melhoria_uti', 'respiracao', 'Ventilação mecânica', 1, 1), ('melhoria_uti', 'respiracao', 'Oxigênio suplementar', 2, 2), ('melhoria_uti', 'respiracao', 'Respiração espontânea sem oxigênio', 3, 3),
  ('melhoria_uti', 'mobilidade', '0 - Imobilidade total', 0, 1), ('melhoria_uti', 'mobilidade', '1 - Mobilidade limitada na cama', 1, 2), ('melhoria_uti', 'mobilidade', '2 - Mobilidade limitada na cama', 2, 3), ('melhoria_uti', 'mobilidade', '3 - Mobilidade limitada na cama', 3, 4), ('melhoria_uti', 'mobilidade', '4 - Mobilidade na cama e sentado na cadeira', 4, 5), ('melhoria_uti', 'mobilidade', '5', 5, 6), ('melhoria_uti', 'mobilidade', '6', 6, 7), ('melhoria_uti', 'mobilidade', '7 - Mobilidade na cama, sentado na cadeira e em pé', 7, 8), ('melhoria_uti', 'mobilidade', '8', 8, 9), ('melhoria_uti', 'mobilidade', '9', 9, 10), ('melhoria_uti', 'mobilidade', '10 - Mobilidade completa', 10, 11)
)
insert into public.scale_item_options (item_id, label, points, display_order)
select i.id, o.label, o.points, o.ord
from options o
join public.scale_items i on i.scale_type::text = o.scale_type and i.code = o.item_code
on conflict (item_id, points) do update set label = excluded.label, display_order = excluded.display_order;

with grades(label, points, ord) as (values
  ('Grau 0: Sem contração visível', 0, 1),
  ('Grau 1: Contração visível sem movimento do membro (não existente para flexão do quadril)', 1, 2),
  ('Grau 2: Movimento do membro, mas não contra a gravidade', 2, 3),
  ('Grau 3: Movimento contra a gravidade em (quase) toda a extensão', 3, 4),
  ('Grau 4: Movimento contra a gravidade e resistência', 4, 5),
  ('Grau 5: Normal', 5, 6)
)
insert into public.scale_item_options (item_id, label, points, display_order)
select i.id, g.label, g.points, g.ord
from public.scale_items i cross join grades g
where i.scale_type = 'mrc'
on conflict (item_id, points) do update set label = excluded.label, display_order = excluded.display_order;

commit;
