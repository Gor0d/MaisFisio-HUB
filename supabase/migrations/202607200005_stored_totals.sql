-- O total das avaliações era agregado a partir de scale_scores em toda leitura
-- (~350 mil linhas no histórico), mantendo o dashboard acima do timeout mesmo
-- com as views security definer. O total passa a ser armazenado na própria
-- avaliação e recalculado por trigger a cada resposta gravada: continua sendo
-- um valor derivado que o usuário nunca digita.

alter table public.scale_assessments
  add column if not exists total integer not null default 0,
  add column if not exists answered_items integer not null default 0,
  add column if not exists expected_items integer not null default 0,
  add column if not exists complete boolean not null default false;

create or replace function public.refresh_assessment_totals()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target uuid := coalesce(new.assessment_id, old.assessment_id);
begin
  update public.scale_assessments a set
    total = coalesce((select sum(o.points) from public.scale_scores s join public.scale_item_options o on o.id = s.option_id where s.assessment_id = target), 0),
    answered_items = (select count(*) from public.scale_scores s where s.assessment_id = target),
    expected_items = (select count(*) from public.scale_items i where i.scale_type = a.scale_type),
    complete = (select count(*) from public.scale_scores s where s.assessment_id = target)
             = (select count(*) from public.scale_items i where i.scale_type = a.scale_type)
  where a.id = target;
  return coalesce(new, old);
end;
$$;

drop trigger if exists scale_scores_refresh_totals on public.scale_scores;
create trigger scale_scores_refresh_totals
after insert or update or delete on public.scale_scores
for each row execute function public.refresh_assessment_totals();

-- Backfill do histórico já importado.
update public.scale_assessments a set
  total = agg.total,
  answered_items = agg.answered
from (
  select s.assessment_id, coalesce(sum(o.points), 0)::integer as total, count(*)::integer as answered
  from public.scale_scores s
  join public.scale_item_options o on o.id = s.option_id
  group by s.assessment_id
) agg
where agg.assessment_id = a.id;

update public.scale_assessments a set
  expected_items = items.expected,
  complete = a.answered_items = items.expected
from (select scale_type, count(*)::integer as expected from public.scale_items group by scale_type) items
where items.scale_type = a.scale_type;

-- Views passam a ler as colunas armazenadas: sem agregação por leitura.
drop view if exists public.dashboard_scale_summary;
drop view if exists public.scale_assessment_results;
drop view if exists public.scale_assessment_totals;

create view public.scale_assessment_totals as
select
  a.id, a.unit_id, a.scale_type, a.patient_id, a.collaborator_id,
  a.assessment_date, a.moment, a.sector_id, a.attendance_number,
  a.total, a.answered_items, a.expected_items, a.complete
from public.scale_assessments a
where public.is_member_of(a.unit_id);

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
  public.dashboard_scale_summary from public, anon;
grant select on public.scale_assessment_totals, public.scale_assessment_results,
  public.dashboard_scale_summary to authenticated, service_role;
