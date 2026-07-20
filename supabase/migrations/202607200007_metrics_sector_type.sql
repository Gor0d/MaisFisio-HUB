-- O dashboard por especialidade quebra a produção por tipo de setor
-- (Médica/Ortopédica/Cirúrgica), que existia no lançamento mas não era
-- exposto pela view de métricas. Coluna adicionada ao final (compatível
-- com create or replace).

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
  r.sector_type
from public.production_records r
join public.indicators i on i.service_id = r.service_id and i.context = r.context and i.active
left join public.production_values v on v.record_id = r.id and v.indicator_id = i.id
left join public.production_values num on num.record_id = r.id and num.indicator_id = i.numerator_indicator_id
left join public.production_values den on den.record_id = r.id and den.indicator_id = i.denominator_indicator_id
where (v.record_id is not null or (i.derived and num.record_id is not null and den.record_id is not null))
  and ((select public.is_super_admin())
    or exists (select 1 from public.profile_units pu where pu.user_id = (select auth.uid()) and pu.unit_id = r.unit_id))
  and ((select public.current_app_role()) in ('super_admin', 'admin') or r.service_id = (select public.current_service_id()));
