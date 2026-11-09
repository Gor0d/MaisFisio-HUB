-- Indicadores de qualidade (Interact Suite): a equipe cadastra a fórmula de cada
-- indicador do portal a partir dos indicadores de contagem que o HUB já coleta
-- e o sistema calcula o resultado mensal automaticamente, para exportar/digitar
-- no portal.
--
-- Modelo:
--   - numerador  = soma dos indicadores de contagem escolhidos
--   - denominador (opcional) = soma de outros indicadores de contagem
--   - resultado = numerador (sem denominador) ou numerador ÷ denominador × fator
--   - filtro opcional de setores (ex.: só a UTI)
--
-- Escopo: por unidade (cada hospital tem seu catálogo do Interact). Somente
-- admin da unidade e matriz leem/gerenciam: o cálculo cruza serviços, e um
-- coordenador (RLS limitada ao próprio serviço) veria números parciais sem
-- perceber — melhor não expor do que expor um valor errado.

begin;

create table public.quality_indicators (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id),
  service_id uuid references public.services(id),
  name text not null check (char_length(trim(name)) between 3 and 200),
  interact_code text check (char_length(interact_code) <= 60),
  numerator_ids uuid[] not null check (cardinality(numerator_ids) >= 1),
  denominator_ids uuid[] not null default '{}',
  sector_ids uuid[] not null default '{}',
  multiplier numeric not null default 100 check (multiplier > 0),
  result_unit text not null default '%' check (char_length(result_unit) between 1 and 20),
  decimals smallint not null default 2 check (decimals between 0 and 6),
  target_value numeric check (target_value >= 0),
  target_comparison text check (target_comparison in ('minimo', 'maximo')),
  notes text check (char_length(notes) <= 2000),
  active boolean not null default true,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((target_value is null) = (target_comparison is null))
);

create unique index quality_indicators_unit_name_key
  on public.quality_indicators (unit_id, lower(trim(name)));
create index quality_indicators_unit_idx on public.quality_indicators (unit_id) where active;

-- Integridade dos arrays (não há FK em uuid[]): só indicadores de contagem do
-- catálogo, setores da própria unidade, sem repetição.
create or replace function public.validate_quality_indicator()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  distinct_count integer;
  matched_count integer;
begin
  new.name := trim(new.name);

  if tg_op = 'UPDATE' and new.unit_id <> old.unit_id then
    raise exception 'A unidade de um indicador de qualidade não pode ser alterada';
  end if;

  select count(distinct x) into distinct_count from unnest(new.numerator_ids) x;
  if distinct_count <> cardinality(new.numerator_ids) then
    raise exception 'O numerador possui indicadores repetidos';
  end if;
  select count(*) into matched_count from public.indicators i
    where i.id = any (new.numerator_ids) and i.kind = 'contagem' and not i.derived;
  if matched_count <> distinct_count then
    raise exception 'O numerador aceita apenas indicadores de contagem do catálogo';
  end if;

  if cardinality(new.denominator_ids) > 0 then
    select count(distinct x) into distinct_count from unnest(new.denominator_ids) x;
    if distinct_count <> cardinality(new.denominator_ids) then
      raise exception 'O denominador possui indicadores repetidos';
    end if;
    select count(*) into matched_count from public.indicators i
      where i.id = any (new.denominator_ids) and i.kind = 'contagem' and not i.derived;
    if matched_count <> distinct_count then
      raise exception 'O denominador aceita apenas indicadores de contagem do catálogo';
    end if;
  else
    new.multiplier := 1;  -- sem denominador o resultado é a própria soma
  end if;

  if cardinality(new.sector_ids) > 0 then
    select count(distinct x) into distinct_count from unnest(new.sector_ids) x;
    select count(*) into matched_count from public.sectors s
      where s.id = any (new.sector_ids) and s.unit_id = new.unit_id;
    if matched_count <> distinct_count or distinct_count <> cardinality(new.sector_ids) then
      raise exception 'Os setores do filtro devem pertencer à unidade do indicador';
    end if;
  end if;

  return new;
end;
$$;

create trigger quality_indicators_validation before insert or update on public.quality_indicators
  for each row execute function public.validate_quality_indicator();
create trigger quality_indicators_updated_at before update on public.quality_indicators
  for each row execute function public.set_updated_at();
create trigger audit_quality_indicators after insert or update or delete on public.quality_indicators
  for each row execute function public.write_audit_log();

alter table public.quality_indicators enable row level security;

create policy "admins read quality indicators" on public.quality_indicators for select to authenticated
using (public.is_member_of(unit_id) and public.current_app_role() in ('super_admin', 'admin'));

create policy "admins manage quality indicators" on public.quality_indicators for all to authenticated
using (public.is_member_of(unit_id) and public.current_app_role() in ('super_admin', 'admin'))
with check (public.is_member_of(unit_id) and public.current_app_role() in ('super_admin', 'admin'));

-- Cálculo do período. security invoker: unidade/serviço continuam vindo da RLS
-- de production_records/production_values.
--   numerador/denominador = soma dos valores lançados no período;
--   *_records = nº de lançamentos que contribuíram (0 = sem dados);
--   value é nulo (e não zero) quando falta dado ou o denominador soma zero —
--   "sem lançamento" e "resultado zero" são coisas diferentes para o portal.
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
language sql stable security invoker set search_path = public
as $$
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
  from public.quality_indicators q
  left join lateral (
    select sum(v.numeric_value) as total, count(distinct r.id) as records
    from public.production_records r
    join public.production_values v on v.record_id = r.id
    where v.indicator_id = any (q.numerator_ids)
      and r.record_date between p_start and p_end
      and r.unit_id = q.unit_id
      and (cardinality(q.sector_ids) = 0 or r.sector_id = any (q.sector_ids))
  ) n on true
  left join lateral (
    select sum(v.numeric_value) as total, count(distinct r.id) as records
    from public.production_records r
    join public.production_values v on v.record_id = r.id
    where cardinality(q.denominator_ids) > 0
      and v.indicator_id = any (q.denominator_ids)
      and r.record_date between p_start and p_end
      and r.unit_id = q.unit_id
      and (cardinality(q.sector_ids) = 0 or r.sector_id = any (q.sector_ids))
  ) d on true
  where q.active and (p_unit is null or q.unit_id = p_unit)
$$;

revoke all on function public.quality_indicator_results(date, date, uuid) from public;
grant execute on function public.quality_indicator_results(date, date, uuid) to authenticated;

commit;
