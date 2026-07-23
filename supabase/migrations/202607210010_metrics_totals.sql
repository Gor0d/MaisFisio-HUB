-- P1: agregação correta de taxas + fim dos truncamentos silenciosos nos
-- totais do dashboard e dos relatórios.
--
-- Antes, dashboard e relatórios buscavam até 10-20 mil linhas BRUTAS (uma por
-- lançamento×indicador) e somavam tudo em JavaScript — inclusive indicadores
-- do tipo "taxa" (percentuais digitados), que não fazem sentido somados: 30
-- dias a ~90%/dia viravam "2700%" no relatório mensal. Em períodos maiores
-- que o limite, os totais também ficavam simplesmente errados por corte
-- silencioso, sem aviso.
--
-- Esta função agrega no banco, sem limite de linhas (o resultado tem no
-- máximo 1 linha por indicador ativo, hoje ~101):
--   - contagem  -> soma no período
--   - taxa (digitada) -> média simples no período (decisão registrada em
--     AGENTS.md: não há numerador/denominador estruturado para ponderar; a
--     coleta manual de percentual pronto é uma limitação herdada da
--     planilha, melhoria futura seria pedir os dois componentes)
--   - taxa derivada (ex.: índice de melhoria da Fono) -> soma(numerador) /
--     soma(denominador), nunca a média das razões diárias (evita o viés de
--     Simpson: dia com poucos casos não pode pesar igual a dia cheio) — nulo
--     com segurança quando o denominador soma zero.
--
-- security invoker: a filtragem por unidade/serviço continua vindo das
-- políticas RLS de production_records/production_values, sem duplicar a
-- lógica aqui.

begin;

create or replace function public.production_metrics_totals(
  p_start date, p_end date, p_unit uuid default null, p_service uuid default null, p_sector uuid default null
)
returns table (indicator_id uuid, indicator_code text, indicator_name text, kind public.indicator_kind, derived boolean, total numeric)
language sql stable security invoker set search_path = public
as $$
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
        from public.production_records r
        join public.production_values num on num.record_id = r.id and num.indicator_id = i.numerator_indicator_id
        join public.production_values den on den.record_id = r.id and den.indicator_id = i.denominator_indicator_id
        where r.record_date between p_start and p_end
          and (p_unit is null or r.unit_id = p_unit)
          and (p_service is null or r.service_id = p_service)
          and (p_sector is null or r.sector_id = p_sector)
      )
      when i.kind = 'taxa' then (
        select round(avg(v.numeric_value), 2)
        from public.production_records r
        join public.production_values v on v.record_id = r.id and v.indicator_id = i.id
        where r.record_date between p_start and p_end
          and (p_unit is null or r.unit_id = p_unit)
          and (p_service is null or r.service_id = p_service)
          and (p_sector is null or r.sector_id = p_sector)
      )
      else (
        select sum(v.numeric_value)
        from public.production_records r
        join public.production_values v on v.record_id = r.id and v.indicator_id = i.id
        where r.record_date between p_start and p_end
          and (p_unit is null or r.unit_id = p_unit)
          and (p_service is null or r.service_id = p_service)
          and (p_sector is null or r.sector_id = p_sector)
      )
    end as total
  from public.indicators i
  where i.active
$$;

revoke all on function public.production_metrics_totals(date, date, uuid, uuid, uuid) from public;
grant execute on function public.production_metrics_totals(date, date, uuid, uuid, uuid) to authenticated;

commit;
