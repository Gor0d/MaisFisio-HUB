-- A checagem de unidade nas views chamava public.is_member_of() por linha
-- (~33 mil execuções da função por consulta). Inlinada como subconsulta
-- não-correlacionada (avaliada uma vez) + EXISTS que o planejador transforma
-- em semi-join. Mesmas regras de acesso, custo por consulta constante.

drop view if exists public.dashboard_scale_summary;
drop view if exists public.scale_assessment_results;
drop view if exists public.scale_assessment_totals;
drop view if exists public.production_metrics;

create view public.scale_assessment_totals as
select
  a.id, a.unit_id, a.scale_type, a.patient_id, a.collaborator_id,
  a.assessment_date, a.moment, a.sector_id, a.attendance_number,
  a.total, a.answered_items, a.expected_items, a.complete
from public.scale_assessments a
where (select public.is_super_admin())
   or exists (select 1 from public.profile_units pu where pu.user_id = (select auth.uid()) and pu.unit_id = a.unit_id);

create view public.scale_assessment_results as
select
  t.*,
  p.initials,
  p.record_number,
  previous.total as entry_total,
  case
    when t.moment = 'saida' and previous.total is not null and t.complete and previous.complete
      then t.total > previous.total
    else null
  end as improved
from public.scale_assessment_totals t
join public.patients p on p.id = t.patient_id
left join lateral (
  select e.total, e.complete
  from public.scale_assessments e
  where e.patient_id = t.patient_id
    and e.scale_type = t.scale_type
    and e.moment = 'entrada'
    and coalesce(e.attendance_number, '') = coalesce(t.attendance_number, '')
    and e.assessment_date <= t.assessment_date
  order by e.assessment_date desc
  limit 1
) previous on t.moment = 'saida';

create view public.production_metrics as
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
  v.text_value
from public.production_records r
join public.indicators i on i.service_id = r.service_id and i.context = r.context and i.active
left join public.production_values v on v.record_id = r.id and v.indicator_id = i.id
left join public.production_values num on num.record_id = r.id and num.indicator_id = i.numerator_indicator_id
left join public.production_values den on den.record_id = r.id and den.indicator_id = i.denominator_indicator_id
where (v.record_id is not null or (i.derived and num.record_id is not null and den.record_id is not null))
  and ((select public.is_super_admin())
    or exists (select 1 from public.profile_units pu where pu.user_id = (select auth.uid()) and pu.unit_id = r.unit_id))
  and ((select public.current_app_role()) in ('super_admin', 'admin') or r.service_id = (select public.current_service_id()));

create view public.dashboard_scale_summary as
select
  unit_id,
  scale_type,
  date_trunc('month', assessment_date)::date as month,
  count(*) filter (where moment = 'saida')::integer as discharges,
  count(*) filter (where moment = 'saida' and improved)::integer as improvements,
  round(100.0 * count(*) filter (where moment = 'saida' and improved)
    / nullif(count(*) filter (where moment = 'saida' and improved is not null), 0), 2) as improvement_rate,
  round(avg(total) filter (where moment = 'entrada'), 2) as average_entry,
  round(avg(total) filter (where moment = 'saida'), 2) as average_exit
from public.scale_assessment_results
where complete
group by unit_id, scale_type, date_trunc('month', assessment_date);

revoke all on public.scale_assessment_totals, public.scale_assessment_results,
  public.production_metrics, public.dashboard_scale_summary from public, anon;
grant select on public.scale_assessment_totals, public.scale_assessment_results,
  public.production_metrics, public.dashboard_scale_summary to authenticated, service_role;
