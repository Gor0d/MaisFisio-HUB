-- Desempenho do dashboard e base do painel de B.I. mensal (16/11/2026).
--
-- Medido em produção antes desta migração (usuário admin, com RLS):
--   production_metrics_totals: ~8 s, qualquer período (cada indicador varria
--   os lançamentos de novo, com a RLS avaliada linha a linha);
--   dashboard de 12 meses: ~14 s, baixando ~197 mil linhas brutas só para
--   desenhar gráficos.
--
-- Agora:
-- - os lançamentos do recorte são selecionados UMA vez (CTE) e reaproveitados
--   por todos os indicadores;
-- - as funções rodam como security definer e aplicam explicitamente a MESMA
--   regra de acesso da view production_metrics e da RLS de production_records
--   (unidade do usuário, ou matriz; fora admin/matriz, só o próprio serviço),
--   calculada uma vez por consulta em vez de por linha;
-- - production_metrics_grouped devolve os números já agregados por dia, mês,
--   turno, setor ou tipo de setor, com as mesmas regras dos totais
--   (contagem soma, taxa digitada tira média, taxa derivada faz
--   soma(numerador)/soma(denominador)).

begin;

create or replace function public.production_metrics_grouped(
  p_start date,
  p_end date,
  p_unit uuid,
  p_service uuid,
  p_sector uuid,
  p_shift public.work_shift,
  p_collaborator uuid,
  p_group text,
  p_indicator uuid default null
)
returns table (
  bucket text,
  indicator_id uuid,
  indicator_code text,
  indicator_name text,
  kind public.indicator_kind,
  derived boolean,
  total numeric,
  records bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with recs as (
    select
      r.id,
      case p_group
        when 'day' then to_char(r.record_date, 'YYYY-MM-DD')
        when 'month' then to_char(r.record_date, 'YYYY-MM')
        when 'shift' then r.shift::text
        when 'sector' then r.sector_id::text
        when 'sector_type' then r.sector_type::text
        else 'total'
      end as bucket
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
      -- Regra de acesso (idêntica à RLS de production_records).
      and ((select public.is_super_admin())
        or r.unit_id in (select pu.unit_id from public.profile_units pu where pu.user_id = (select auth.uid())))
      and ((select public.current_app_role()) in ('super_admin', 'admin')
        or r.service_id = (select public.current_service_id()))
  ),
  inds as (
    select i.*
    from public.indicators i
    where i.active
      and i.kind <> 'texto'
      and (p_indicator is null or i.id = p_indicator)
      and (p_service is null or i.service_id = p_service)
  ),
  plain as (
    select recs.bucket, v.indicator_id,
      sum(v.numeric_value) as s, avg(v.numeric_value) as a, count(*) as n
    from recs
    join public.production_values v on v.record_id = recs.id
    join inds i on i.id = v.indicator_id and not i.derived
    where v.numeric_value is not null
    group by recs.bucket, v.indicator_id
  ),
  ratio as (
    select recs.bucket, i.id as indicator_id,
      sum(num.numeric_value) as sn, sum(den.numeric_value) as sd, count(*) as n
    from inds i
    join public.production_values num on num.indicator_id = i.numerator_indicator_id
    join recs on recs.id = num.record_id
    join public.production_values den on den.record_id = num.record_id and den.indicator_id = i.denominator_indicator_id
    where i.derived
    group by recs.bucket, i.id
  )
  select p.bucket, i.id, i.code, i.name, i.kind, false,
    case when i.kind = 'taxa' then round(p.a, 2) else p.s end, p.n
  from plain p join inds i on i.id = p.indicator_id
  union all
  select r.bucket, i.id, i.code, i.name, i.kind, true,
    case when r.sd > 0 then round(r.sn / r.sd * 100, 2) end, r.n
  from ratio r join inds i on i.id = r.indicator_id;
$$;

revoke all on function public.production_metrics_grouped(date, date, uuid, uuid, uuid, public.work_shift, uuid, text, uuid) from public, anon;
grant execute on function public.production_metrics_grouped(date, date, uuid, uuid, uuid, public.work_shift, uuid, text, uuid) to authenticated;

-- Totais (cartões do dashboard, relatório mensal): mesma base, uma linha por
-- indicador ativo (null quando não há dado), como antes.
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
security definer
set search_path = public
as $$
  select i.id, i.code, i.name, i.kind, i.derived, g.total
  from public.indicators i
  left join public.production_metrics_grouped(
    p_start, p_end, p_unit, p_service, p_sector, p_shift, p_collaborator, 'total', null
  ) g on g.indicator_id = i.id
  where i.active;
$$;

create or replace function public.production_metrics_totals(
  p_start date,
  p_end date,
  p_unit uuid default null,
  p_service uuid default null,
  p_sector uuid default null
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
security definer
set search_path = public
as $$
  select * from public.production_metrics_totals(p_start, p_end, p_unit, p_service, p_sector, null, null);
$$;

revoke all on function public.production_metrics_totals(date, date, uuid, uuid, uuid, public.work_shift, uuid) from public, anon;
grant execute on function public.production_metrics_totals(date, date, uuid, uuid, uuid, public.work_shift, uuid) to authenticated;
revoke all on function public.production_metrics_totals(date, date, uuid, uuid, uuid) from public, anon;
grant execute on function public.production_metrics_totals(date, date, uuid, uuid, uuid) to authenticated;

commit;
