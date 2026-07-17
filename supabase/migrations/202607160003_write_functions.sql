begin;

create or replace function public.save_production_record(payload jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  saved_id uuid;
  value jsonb;
begin
  insert into public.production_records (
    service_id, record_date, shift, sector_id, sector_type,
    collaborator_id, context, notes, created_by
  ) values (
    (payload ->> 'service_id')::uuid,
    (payload ->> 'record_date')::date,
    (payload ->> 'shift')::public.work_shift,
    (payload ->> 'sector_id')::uuid,
    nullif(payload ->> 'sector_type', '')::public.sector_type,
    (payload ->> 'collaborator_id')::uuid,
    coalesce(nullif(payload ->> 'context', ''), 'geral'),
    nullif(payload ->> 'notes', ''),
    auth.uid()
  )
  returning id into saved_id;

  for value in select * from jsonb_array_elements(coalesce(payload -> 'values', '[]'::jsonb))
  loop
    if nullif(value ->> 'value', '') is not null then
      insert into public.production_values (record_id, indicator_id, numeric_value, text_value)
      select
        saved_id,
        (value ->> 'indicator_id')::uuid,
        case when i.kind <> 'texto' then (value ->> 'value')::numeric end,
        case when i.kind = 'texto' then value ->> 'value' end
      from public.indicators i
      where i.id = (value ->> 'indicator_id')::uuid;
    end if;
  end loop;

  return saved_id;
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
begin
  if coalesce(payload ->> 'initials', '') !~ '^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ. -]{0,29}$' then
    raise exception 'Informe somente as iniciais do paciente';
  end if;

  select id into saved_patient_id
  from public.patients
  where record_number = trim(payload ->> 'record_number');

  if saved_patient_id is null then
    insert into public.patients (initials, record_number, age)
    values (
      upper(trim(payload ->> 'initials')),
      trim(payload ->> 'record_number'),
      nullif(payload ->> 'age', '')::smallint
    ) returning id into saved_patient_id;
  end if;

  select count(*) into expected_count
  from public.scale_items where scale_type = (payload ->> 'scale_type')::public.scale_type;
  select count(*) into answer_count
  from jsonb_array_elements(coalesce(payload -> 'answers', '[]'::jsonb));
  if answer_count <> expected_count then
    raise exception 'Todos os itens da escala devem ser respondidos';
  end if;

  insert into public.scale_assessments (
    scale_type, patient_id, collaborator_id, assessment_date, moment,
    sector_id, sector_type, attendance_number, cid, event_date, notes, created_by
  ) values (
    (payload ->> 'scale_type')::public.scale_type,
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

grant execute on function public.save_production_record(jsonb) to authenticated;
grant execute on function public.save_scale_assessment(jsonb) to authenticated;

commit;
