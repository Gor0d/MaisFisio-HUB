-- Vários colaboradores por lançamento de produção (decisão de 15/11/2026).
--
-- Na planilha, quando mais de uma pessoa trabalhava no turno, o nome do
-- grupo virava um "colaborador" só ("AMANDA/FELIX"). Agora:
-- - um lançamento por (serviço, data, turno, setor, contexto), com N
--   colaboradores escolhidos individualmente;
-- - production_records.collaborator_id continua existindo como o primeiro
--   colaborador, para manter compatíveis consultas, índices e o histórico;
-- - histórico preservado: cada lançamento antigo é copiado para a tabela nova
--   com o colaborador que já tinha (decisão: limpar só daqui para frente);
-- - nomes compostos e números soltos ("1752") saem das listas de escolha
--   (active = false), sem apagar nada.

begin;

create table public.production_record_collaborators (
  record_id uuid not null references public.production_records(id) on delete cascade,
  collaborator_id uuid not null references public.collaborators(id),
  position smallint not null default 1 check (position between 1 and 20),
  primary key (record_id, collaborator_id)
);

-- Filtro "por colaborador" no dashboard e nos totais.
create index production_record_collaborators_collaborator_idx
  on public.production_record_collaborators (collaborator_id, record_id);

insert into public.production_record_collaborators (record_id, collaborator_id, position)
select id, collaborator_id, 1
from public.production_records
on conflict do nothing;

-- Mesmo escopo de leitura/escrita de production_values (filha de production_records).
alter table public.production_record_collaborators enable row level security;

create policy "service reads production collaborators" on public.production_record_collaborators
for select to authenticated
using (exists (
  select 1 from public.production_records r where r.id = record_id
    and public.is_member_of(r.unit_id)
    and (public.current_app_role() in ('super_admin', 'admin') or r.service_id = public.current_service_id())
));

create policy "owner writes production collaborators" on public.production_record_collaborators
for all to authenticated
using (exists (
  select 1 from public.production_records r where r.id = record_id
    and (r.created_by = auth.uid() or public.is_manager())
))
with check (exists (
  select 1 from public.production_records r where r.id = record_id
    and (r.created_by = auth.uid() or public.is_manager())
));

grant select, insert, update, delete on public.production_record_collaborators to authenticated;

-- Cada colaborador do lançamento precisa ser do serviço e da unidade do lançamento
-- (a mesma regra que validate_production_unit aplica ao colaborador principal).
create or replace function public.validate_production_collaborator()
returns trigger language plpgsql
set search_path = public
as $$
declare
  rec record;
begin
  select unit_id, service_id into rec from public.production_records where id = new.record_id;
  if not exists (
    select 1 from public.collaborator_units cu
    where cu.collaborator_id = new.collaborator_id and cu.unit_id = rec.unit_id
  ) then
    raise exception 'Colaborador não está vinculado à unidade do lançamento';
  end if;
  if not exists (
    select 1 from public.collaborators c
    where c.id = new.collaborator_id and c.service_id = rec.service_id
  ) then
    raise exception 'Colaborador não pertence ao serviço do lançamento';
  end if;
  return new;
end;
$$;

create trigger production_collaborator_validation
before insert or update on public.production_record_collaborators
for each row execute function public.validate_production_collaborator();

-- Todo lançamento tem ao menos o colaborador principal na equipe, mesmo quando
-- inserido direto na tabela (script de importação, service_role), sem passar
-- por save_production_record. Trocar o principal atualiza a posição 1.
create or replace function public.sync_production_primary_collaborator()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.collaborator_id is not distinct from old.collaborator_id then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    delete from public.production_record_collaborators
    where record_id = new.id and collaborator_id = old.collaborator_id;
  end if;
  insert into public.production_record_collaborators (record_id, collaborator_id, position)
  values (new.id, new.collaborator_id, 1)
  on conflict (record_id, collaborator_id) do update set position = 1;
  return new;
end;
$$;

create trigger production_primary_collaborator_sync
after insert or update of collaborator_id on public.production_records
for each row execute function public.sync_production_primary_collaborator();

-- Gravação: aceita collaborator_ids (lista) e, por compatibilidade, o antigo
-- collaborator_id. Um único lançamento por dia/turno/setor/serviço/contexto.
create or replace function public.save_production_record(payload jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  saved_id uuid;
  value jsonb;
  ids uuid[];
  v_service uuid := (payload ->> 'service_id')::uuid;
  v_date date := (payload ->> 'record_date')::date;
  v_shift public.work_shift := (payload ->> 'shift')::public.work_shift;
  v_sector uuid := (payload ->> 'sector_id')::uuid;
  v_context text := coalesce(nullif(payload ->> 'context', ''), 'geral');
begin
  select coalesce(array_agg(distinct_ids.id order by distinct_ids.first_pos), '{}')
    into ids
  from (
    select (elem)::uuid as id, min(pos) as first_pos
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(payload -> 'collaborator_ids') = 'array' then payload -> 'collaborator_ids'
        when nullif(payload ->> 'collaborator_id', '') is not null then jsonb_build_array(payload ->> 'collaborator_id')
        else '[]'::jsonb
      end
    ) with ordinality as t(elem, pos)
    where nullif(elem, '') is not null
    group by 1
  ) distinct_ids;

  if cardinality(ids) = 0 then
    raise exception 'Selecione ao menos um colaborador';
  end if;
  if cardinality(ids) > 20 then
    raise exception 'No máximo 20 colaboradores por lançamento';
  end if;

  -- Serializa lançamentos concorrentes da mesma chave antes de checar duplicidade.
  perform pg_advisory_xact_lock(hashtextextended(concat_ws('|', v_service, v_date, v_shift, v_sector, v_context), 0));
  if exists (
    select 1 from public.production_records r
    where r.service_id = v_service and r.record_date = v_date and r.shift = v_shift
      and r.sector_id = v_sector and r.context = v_context
  ) then
    raise exception 'Já existe um lançamento deste serviço para este dia, turno e setor'
      using errcode = '23505';
  end if;

  insert into public.production_records (
    unit_id, service_id, record_date, shift, sector_id, sector_type,
    collaborator_id, context, notes, created_by
  ) values (
    (payload ->> 'unit_id')::uuid,
    v_service,
    v_date,
    v_shift,
    v_sector,
    nullif(payload ->> 'sector_type', '')::public.sector_type,
    ids[1],
    v_context,
    nullif(payload ->> 'notes', ''),
    auth.uid()
  )
  returning id into saved_id;

  -- O principal (ids[1]) já entrou pelo gatilho de sincronização; aqui entram
  -- os demais, na ordem em que foram escolhidos.
  insert into public.production_record_collaborators (record_id, collaborator_id, position)
  select saved_id, c.id, c.pos::smallint
  from unnest(ids) with ordinality as c(id, pos)
  on conflict (record_id, collaborator_id) do update set position = excluded.position;

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

grant execute on function public.save_production_record(jsonb) to authenticated;

-- View de métricas: nova coluna collaborator_ids no fim (compatível com
-- create or replace). O filtro por colaborador passa a casar qualquer membro
-- da equipe do lançamento, não só o primeiro.
create or replace view public.production_metrics as
select
  r.id as record_id,
  r.unit_id,
  r.service_id,
  r.record_date,
  r.shift,
  r.sector_id,
  r.collaborator_id,
  r.context,
  i.id as indicator_id,
  i.code as indicator_code,
  i.name as indicator_name,
  i.kind,
  coalesce(
    v.numeric_value,
    case when i.derived then (num.numeric_value / nullif(den.numeric_value, 0)) * 100 end
  ) as value,
  v.text_value,
  r.sector_type,
  team.collaborator_ids
from public.production_records r
join public.indicators i on i.service_id = r.service_id and i.context = r.context and i.active
left join public.production_values v on v.record_id = r.id and v.indicator_id = i.id
left join public.production_values num on num.record_id = r.id and num.indicator_id = i.numerator_indicator_id
left join public.production_values den on den.record_id = r.id and den.indicator_id = i.denominator_indicator_id
left join lateral (
  select array_agg(prc.collaborator_id order by prc.position) as collaborator_ids
  from public.production_record_collaborators prc
  where prc.record_id = r.id
) team on true
where (v.record_id is not null or (i.derived and num.record_id is not null and den.record_id is not null))
  and ((select public.is_super_admin())
    or exists (select 1 from public.profile_units pu where pu.user_id = (select auth.uid()) and pu.unit_id = r.unit_id))
  and ((select public.current_app_role()) in ('super_admin', 'admin') or r.service_id = (select public.current_service_id()));

-- Totais agregados: filtro por colaborador considera a equipe inteira.
create or replace function public.production_metrics_totals(
  p_start date,
  p_end date,
  p_unit uuid,
  p_service uuid,
  p_sector uuid,
  p_shift public.work_shift,
  p_collaborator uuid
)
returns table (
  indicator_id uuid,
  indicator_code text,
  indicator_name text,
  kind public.indicator_kind,
  derived boolean,
  total numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with recs as (
    select r.id
    from public.production_records r
    where r.record_date between p_start and p_end
      and (p_unit is null or r.unit_id = p_unit)
      and (p_service is null or r.service_id = p_service)
      and (p_sector is null or r.sector_id = p_sector)
      and (p_shift is null or r.shift = p_shift)
      and (p_collaborator is null or exists (
        select 1 from public.production_record_collaborators prc
        where prc.record_id = r.id and prc.collaborator_id = p_collaborator
      ))
  )
  select
    i.id,
    i.code,
    i.name,
    i.kind,
    i.derived,
    case
      when i.derived then (
        select case when sum(den.numeric_value) > 0
          then round(sum(num.numeric_value) / sum(den.numeric_value) * 100, 2)
          else null end
        from recs
        join public.production_values num
          on num.record_id = recs.id and num.indicator_id = i.numerator_indicator_id
        join public.production_values den
          on den.record_id = recs.id and den.indicator_id = i.denominator_indicator_id
      )
      when i.kind = 'taxa' then (
        select round(avg(v.numeric_value), 2)
        from recs
        join public.production_values v on v.record_id = recs.id and v.indicator_id = i.id
      )
      else (
        select sum(v.numeric_value)
        from recs
        join public.production_values v on v.record_id = recs.id and v.indicator_id = i.id
      )
    end as total
  from public.indicators i
  where i.active;
$$;

-- Nomes compostos ("AMANDA/FELIX", "ROSANGELA+ANNE") e números soltos saem
-- das listas de escolha. Contas com login vinculado nunca são desativadas.
update public.collaborators
set active = false
where user_id is null
  and active
  and (canonical_name ~ '[/+&,;]' or canonical_name ~ '^\s*\d+\s*$');

commit;
