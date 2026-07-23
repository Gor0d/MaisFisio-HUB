-- P1: validação de iniciais mais rígida + coerência de lançamentos.
--
-- Iniciais: o regex anterior só restringia o conjunto de caracteres, então
-- "MARIA APARECIDA SILVA" (só letras e espaços) passava. A nova regra aceita
-- dois formatos: (a) grupos de 1-2 letras separados por ponto/espaço, como
-- "J.R.S" ou "M. A. S."; (b) um bloco compacto de 2-4 letras sem separador,
-- como "MAS" ou "EGG". Não é uma detecção perfeita (um nome curto de verdade
-- como "ANA" ainda passaria), mas rejeita de forma confiável qualquer nome
-- com uma palavra de 3+ letras — o padrão real dos nomes completos digitados
-- por engano na planilha.
--
-- Coerência: fecha lacunas que uma trigger anterior não cobria — indicador
-- deve pertencer ao CONTEXTO do lançamento (não só ao serviço), colaborador
-- deve pertencer ao SERVIÇO do lançamento, setor deve estar habilitado para
-- o serviço, e colaborador de uma avaliação de escala deve pertencer à
-- unidade da avaliação. MRC exige colaborador e número de atendimento
-- (conforme a planilha de origem); Barthel e Melhoria UTI não têm esse campo
-- na fonte, então continuam opcionais.

begin;

create or replace function public.validate_production_unit()
returns trigger language plpgsql as $$
begin
  if (select unit_id from public.sectors where id = new.sector_id) is distinct from new.unit_id then
    raise exception 'Setor não pertence à unidade do lançamento';
  end if;
  if not exists (select 1 from public.collaborator_units cu where cu.collaborator_id = new.collaborator_id and cu.unit_id = new.unit_id) then
    raise exception 'Colaborador não está vinculado à unidade do lançamento';
  end if;
  if not exists (select 1 from public.collaborators c where c.id = new.collaborator_id and c.service_id = new.service_id) then
    raise exception 'Colaborador não pertence ao serviço do lançamento';
  end if;
  if not exists (select 1 from public.service_sectors ss where ss.service_id = new.service_id and ss.sector_id = new.sector_id) then
    raise exception 'Setor não está habilitado para este serviço';
  end if;
  return new;
end;
$$;

create or replace function public.validate_assessment_unit()
returns trigger language plpgsql as $$
begin
  if (select unit_id from public.sectors where id = new.sector_id) is distinct from new.unit_id then
    raise exception 'Setor não pertence à unidade da avaliação';
  end if;
  if (select unit_id from public.patients where id = new.patient_id) is distinct from new.unit_id then
    raise exception 'Paciente não pertence à unidade da avaliação';
  end if;
  if new.collaborator_id is not null and not exists (
    select 1 from public.collaborator_units cu where cu.collaborator_id = new.collaborator_id and cu.unit_id = new.unit_id
  ) then
    raise exception 'Colaborador não está vinculado à unidade da avaliação';
  end if;
  return new;
end;
$$;

create or replace function public.validate_production_value()
returns trigger language plpgsql as $$
declare
  expected_service uuid;
  actual_service uuid;
  expected_context text;
  actual_context text;
  indicator_type public.indicator_kind;
  is_derived boolean;
begin
  select service_id, context into actual_service, actual_context from public.production_records where id = new.record_id;
  select service_id, context, kind, derived into expected_service, expected_context, indicator_type, is_derived
    from public.indicators where id = new.indicator_id;
  if actual_service is distinct from expected_service then
    raise exception 'Indicador não pertence ao serviço do lançamento';
  end if;
  if expected_context is distinct from actual_context then
    raise exception 'Indicador não pertence ao contexto do lançamento';
  end if;
  if is_derived then
    raise exception 'Indicadores derivados não podem ser digitados';
  end if;
  if indicator_type = 'texto' and new.text_value is null then
    raise exception 'Indicador textual exige text_value';
  elsif indicator_type <> 'texto' and new.numeric_value is null then
    raise exception 'Indicador numérico exige numeric_value';
  end if;
  return new;
end;
$$;

create or replace function public.save_scale_assessment(payload jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  saved_patient_id uuid;
  saved_assessment_id uuid;
  answer jsonb;
  expected_count integer;
  answer_count integer;
  scale public.scale_type;
begin
  if upper(trim(coalesce(payload ->> 'initials', ''))) !~
     '^(([A-ZÀ-Ÿ]{1,2}[.[:space:]]+){1,7}[A-ZÀ-Ÿ]{1,2}\.?|[A-ZÀ-Ÿ]{2,4})$' then
    raise exception 'Informe somente as iniciais do paciente (ex.: M.A.S. ou MAS), não o nome completo';
  end if;

  scale := (payload ->> 'scale_type')::public.scale_type;
  if scale = 'mrc' then
    if coalesce(payload ->> 'collaborator_id', '') = '' then
      raise exception 'A escala MRC exige o colaborador responsável';
    end if;
    if coalesce(trim(payload ->> 'attendance_number'), '') = '' then
      raise exception 'A escala MRC exige o número do atendimento';
    end if;
  end if;

  select id into saved_patient_id
  from public.patients
  where unit_id = (payload ->> 'unit_id')::uuid
    and record_number = trim(payload ->> 'record_number');

  if saved_patient_id is null then
    insert into public.patients (unit_id, initials, record_number, age)
    values (
      (payload ->> 'unit_id')::uuid,
      upper(trim(payload ->> 'initials')),
      trim(payload ->> 'record_number'),
      nullif(payload ->> 'age', '')::smallint
    ) returning id into saved_patient_id;
  end if;

  select count(*) into expected_count
  from public.scale_items where scale_type = scale;
  select count(*) into answer_count
  from jsonb_array_elements(coalesce(payload -> 'answers', '[]'::jsonb));
  if answer_count <> expected_count then
    raise exception 'Todos os itens da escala devem ser respondidos';
  end if;

  insert into public.scale_assessments (
    unit_id, scale_type, patient_id, collaborator_id, assessment_date, moment,
    sector_id, sector_type, attendance_number, cid, event_date, notes, created_by
  ) values (
    (payload ->> 'unit_id')::uuid,
    scale,
    saved_patient_id,
    nullif(payload ->> 'collaborator_id', '')::uuid,
    (payload ->> 'assessment_date')::date,
    (payload ->> 'moment')::public.assessment_moment,
    (payload ->> 'sector_id')::uuid,
    nullif(payload ->> 'sector_type', '')::public.sector_type,
    nullif(payload ->> 'attendance_number', ''),
    nullif(payload ->> 'cid', ''),
    nullif(payload ->> 'event_date', '')::date,
    nullif(payload ->> 'notes', ''),
    auth.uid()
  ) returning id into saved_assessment_id;

  for answer in select * from jsonb_array_elements(payload -> 'answers')
  loop
    insert into public.scale_scores (assessment_id, item_id, option_id)
    values (saved_assessment_id, (answer ->> 'item_id')::uuid, (answer ->> 'option_id')::uuid);
  end loop;

  return saved_assessment_id;
end;
$$;

commit;
