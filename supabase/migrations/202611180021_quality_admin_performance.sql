-- Desempenho das telas Qualidade e Administração (18/11/2026).
--
-- Medido no ambiente local com 2026 importado (11 mil lançamentos, 166 mil
-- valores, 21 mil linhas de auditoria), usuário admin:
--   quality_indicator_results: ~5 s com 11 indicadores (cada indicador varria
--     os lançamentos duas vezes, com a RLS avaliada linha a linha);
--   admin_audit_logs: ~4,4 s (política "managers read audit" chamava
--     is_manager() por linha e não havia índice por data).
-- A tela não mostra carregamento, então parecia travada ao clicar no menu.
--
-- Mesma técnica da migração 202611160020: security definer + a MESMA regra de
-- acesso aplicada explicitamente, calculada uma vez por consulta.

begin;

-- 1) Qualidade: lançamentos e valores do período lidos uma vez só.
create or replace function public.quality_indicator_results(
  p_start date, p_end date, p_unit uuid default null
)
returns table (
  quality_indicator_id uuid,
  numerator numeric,
  denominator numeric,
  value numeric,
  numerator_records bigint,
  denominator_records bigint
)
language sql stable security definer set search_path = public
as $$
  with q as (
    -- Regra idêntica à RLS de quality_indicators: membro da unidade e admin/matriz.
    select qi.*
    from public.quality_indicators qi
    where qi.active
      and (p_unit is null or qi.unit_id = p_unit)
      and (select public.current_app_role()) in ('super_admin', 'admin')
      and ((select public.is_super_admin())
        or qi.unit_id in (select pu.unit_id from public.profile_units pu where pu.user_id = (select auth.uid())))
  ),
  wanted as (
    select distinct unnest(q.numerator_ids || q.denominator_ids) as indicator_id from q
  ),
  vals as materialized (
    select r.id as record_id, r.unit_id, r.sector_id, v.indicator_id, v.numeric_value
    from public.production_records r
    join public.production_values v on v.record_id = r.id
    where r.record_date between p_start and p_end
      and r.unit_id in (select q.unit_id from q)
      and v.indicator_id in (select wanted.indicator_id from wanted)
  )
  select
    q.id,
    n.total,
    d.total,
    case
      when cardinality(q.denominator_ids) = 0 then round(n.total, q.decimals)
      when n.total is not null and d.total > 0 then round(n.total / d.total * q.multiplier, q.decimals)
    end,
    coalesce(n.records, 0),
    coalesce(d.records, 0)
  from q
  left join lateral (
    select sum(x.numeric_value) as total, count(distinct x.record_id) as records
    from vals x
    where x.indicator_id = any (q.numerator_ids)
      and x.unit_id = q.unit_id
      and (cardinality(q.sector_ids) = 0 or x.sector_id = any (q.sector_ids))
  ) n on true
  left join lateral (
    select sum(x.numeric_value) as total, count(distinct x.record_id) as records
    from vals x
    where cardinality(q.denominator_ids) > 0
      and x.indicator_id = any (q.denominator_ids)
      and x.unit_id = q.unit_id
      and (cardinality(q.sector_ids) = 0 or x.sector_id = any (q.sector_ids))
  ) d on true
$$;

revoke all on function public.quality_indicator_results(date, date, uuid) from public, anon;
grant execute on function public.quality_indicator_results(date, date, uuid) to authenticated;

-- 2) Auditoria: política avaliada uma vez por consulta (initplan) e índice por data.
drop policy if exists "managers read audit" on public.audit_logs;
create policy "managers read audit" on public.audit_logs for select to authenticated
using ((select public.is_manager()));

create index if not exists audit_logs_changed_at_idx on public.audit_logs (changed_at desc);

create or replace function public.admin_audit_logs(
  p_unit uuid,
  p_limit integer default 100
)
returns table (
  id bigint,
  table_name text,
  action text,
  changed_at timestamptz,
  record_id text,
  changed_by uuid,
  changed_by_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.table_name,
    a.action,
    a.changed_at,
    a.record_id,
    a.changed_by,
    actor.full_name
  from public.audit_logs a
  left join public.profiles actor on actor.user_id = a.changed_by
  where
    -- Mesma exigência da RLS de audit_logs (gestor), agora explícita.
    (select public.is_manager())
    and (
      (p_unit is null and (select public.is_super_admin()))
      or (
        p_unit is not null
        and (select public.is_member_of(p_unit))
        and (
          coalesce(a.new_data ->> 'unit_id', a.old_data ->> 'unit_id') = p_unit::text
          or (
            a.table_name = 'collaborators'
            and exists (
              select 1
              from public.collaborator_units cu
              where cu.collaborator_id::text = coalesce(
                a.record_id,
                a.new_data ->> 'id',
                a.old_data ->> 'id'
              )
                and cu.unit_id = p_unit
            )
          )
          or (
            a.table_name = 'profiles'
            and exists (
              select 1
              from public.profile_units pu
              where pu.user_id::text = coalesce(
                a.new_data ->> 'user_id',
                a.old_data ->> 'user_id'
              )
                and pu.unit_id = p_unit
            )
          )
        )
      )
    )
  order by a.changed_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;

revoke all on function public.admin_audit_logs(uuid, integer) from public, anon;
grant execute on function public.admin_audit_logs(uuid, integer) to authenticated;

commit;
