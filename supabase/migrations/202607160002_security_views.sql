begin;

create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid() and active = true;
$$;

create or replace function public.current_service_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select service_id from public.profiles where user_id = auth.uid() and active = true;
$$;

create or replace function public.is_manager()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.current_app_role() in ('super_admin', 'admin', 'coordenador'), false);
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.current_app_role() = 'super_admin', false);
$$;

-- Vínculo de acesso por unidade; super_admin (matriz) enxerga todas.
create or replace function public.is_member_of(target_unit uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1 from public.profile_units pu
    where pu.user_id = auth.uid() and pu.unit_id = target_unit
  );
$$;

revoke all on function public.current_app_role() from public;
revoke all on function public.current_service_id() from public;
revoke all on function public.is_manager() from public;
revoke all on function public.is_super_admin() from public;
revoke all on function public.is_member_of(uuid) from public;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_service_id() to authenticated;
grant execute on function public.is_manager() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_member_of(uuid) to authenticated;

-- O próprio usuário pode alterar somente o nome. Papel e serviço são definidos
-- por convite administrativo (service role), nunca por metadados de cadastro.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

alter table public.units enable row level security;
alter table public.profile_units enable row level security;
alter table public.collaborator_units enable row level security;
alter table public.services enable row level security;
alter table public.profiles enable row level security;
alter table public.sectors enable row level security;
alter table public.service_sectors enable row level security;
alter table public.collaborators enable row level security;
alter table public.collaborator_aliases enable row level security;
alter table public.patients enable row level security;
alter table public.indicators enable row level security;
alter table public.production_records enable row level security;
alter table public.production_values enable row level security;
alter table public.scale_items enable row level security;
alter table public.scale_item_options enable row level security;
alter table public.scale_assessments enable row level security;
alter table public.scale_scores enable row level security;
alter table public.indicator_targets enable row level security;
alter table public.audit_logs enable row level security;

create policy "authenticated reads units" on public.units for select to authenticated using (true);
create policy "super admin manages units" on public.units for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());

create policy "users read own unit links managers read all" on public.profile_units for select to authenticated
using (user_id = auth.uid() or public.is_manager());
create policy "admins manage profile units" on public.profile_units for all to authenticated
using (public.is_super_admin() or (public.current_app_role() = 'admin' and public.is_member_of(unit_id)))
with check (public.is_super_admin() or (public.current_app_role() = 'admin' and public.is_member_of(unit_id)));

create policy "authenticated reads collaborator units" on public.collaborator_units for select to authenticated using (true);
create policy "admins manage collaborator units" on public.collaborator_units for all to authenticated
using (public.is_super_admin() or (public.current_app_role() in ('admin', 'coordenador') and public.is_member_of(unit_id)))
with check (public.is_super_admin() or (public.current_app_role() in ('admin', 'coordenador') and public.is_member_of(unit_id)));

create policy "authenticated reads services" on public.services for select to authenticated using (true);
create policy "authenticated reads sectors" on public.sectors for select to authenticated using (true);
create policy "authenticated reads service sectors" on public.service_sectors for select to authenticated using (true);
create policy "authenticated reads indicators" on public.indicators for select to authenticated using (true);
create policy "authenticated reads scale items" on public.scale_items for select to authenticated using (true);
create policy "authenticated reads scale options" on public.scale_item_options for select to authenticated using (true);

-- Catálogos clínicos são globais (padrão MaisFisio): somente a matriz altera.
create policy "super admin manages services" on public.services for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());
create policy "unit admin manages sectors" on public.sectors for all to authenticated
using (public.is_super_admin() or (public.current_app_role() = 'admin' and public.is_member_of(unit_id)))
with check (public.is_super_admin() or (public.current_app_role() = 'admin' and public.is_member_of(unit_id)));
create policy "admin manages service sectors" on public.service_sectors for all to authenticated
using (public.is_super_admin() or (public.current_app_role() = 'admin' and public.is_member_of((select s.unit_id from public.sectors s where s.id = sector_id))))
with check (public.is_super_admin() or (public.current_app_role() = 'admin' and public.is_member_of((select s.unit_id from public.sectors s where s.id = sector_id))));
create policy "super admin manages indicators" on public.indicators for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());
create policy "super admin manages scale items" on public.scale_items for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());
create policy "super admin manages scale options" on public.scale_item_options for all to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());

create policy "users read own profile managers read service" on public.profiles for select to authenticated
using (
  user_id = auth.uid()
  or public.current_app_role() in ('super_admin', 'admin')
  or (public.current_app_role() = 'coordenador' and service_id = public.current_service_id())
);
create policy "admin manages profiles" on public.profiles for all to authenticated
using (public.current_app_role() in ('super_admin', 'admin')) with check (public.current_app_role() in ('super_admin', 'admin'));
create policy "user updates own basic profile" on public.profiles for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and role = public.current_app_role());

create policy "authenticated reads collaborators" on public.collaborators for select to authenticated using (active or public.is_manager());
create policy "managers manage collaborators" on public.collaborators for all to authenticated
using (public.current_app_role() in ('super_admin', 'admin') or (public.current_app_role() = 'coordenador' and service_id = public.current_service_id()))
with check (public.current_app_role() in ('super_admin', 'admin') or (public.current_app_role() = 'coordenador' and service_id = public.current_service_id()));
create policy "managers read aliases" on public.collaborator_aliases for select to authenticated using (public.is_manager());
create policy "managers manage aliases" on public.collaborator_aliases for all to authenticated
using (public.is_manager()) with check (public.is_manager());

create policy "unit members read patients" on public.patients for select to authenticated using (public.is_member_of(unit_id));
create policy "unit members create patients" on public.patients for insert to authenticated with check (public.is_member_of(unit_id));
create policy "managers update patients" on public.patients for update to authenticated
using (public.is_manager() and public.is_member_of(unit_id)) with check (public.is_manager() and public.is_member_of(unit_id));

create policy "service reads production" on public.production_records for select to authenticated
using (public.is_member_of(unit_id) and (public.current_app_role() in ('super_admin', 'admin') or service_id = public.current_service_id()));
create policy "service creates production" on public.production_records for insert to authenticated
with check (created_by = auth.uid() and public.is_member_of(unit_id) and (public.current_app_role() in ('super_admin', 'admin') or service_id = public.current_service_id()));
create policy "owner or manager updates production" on public.production_records for update to authenticated
using (public.is_member_of(unit_id) and (created_by = auth.uid() or public.is_manager()))
with check (public.is_member_of(unit_id) and (created_by = auth.uid() or public.is_manager()));
create policy "manager deletes production" on public.production_records for delete to authenticated
using (public.is_manager() and public.is_member_of(unit_id) and (public.current_app_role() in ('super_admin', 'admin') or service_id = public.current_service_id()));

create policy "service reads production values" on public.production_values for select to authenticated
using (exists (
  select 1 from public.production_records r where r.id = record_id
    and public.is_member_of(r.unit_id)
    and (public.current_app_role() in ('super_admin', 'admin') or r.service_id = public.current_service_id())
));
create policy "owner writes production values" on public.production_values for all to authenticated
using (exists (
  select 1 from public.production_records r where r.id = record_id
    and (r.created_by = auth.uid() or public.is_manager())
))
with check (exists (
  select 1 from public.production_records r where r.id = record_id
    and (r.created_by = auth.uid() or public.is_manager())
));

create policy "unit members read assessments" on public.scale_assessments for select to authenticated using (public.is_member_of(unit_id));
create policy "unit members create assessments" on public.scale_assessments for insert to authenticated
with check (created_by = auth.uid() and public.is_member_of(unit_id));
create policy "owner or manager updates assessments" on public.scale_assessments for update to authenticated
using (public.is_member_of(unit_id) and (created_by = auth.uid() or public.is_manager()))
with check (public.is_member_of(unit_id) and (created_by = auth.uid() or public.is_manager()));
create policy "manager deletes assessments" on public.scale_assessments for delete to authenticated
using (public.is_manager() and public.is_member_of(unit_id));
create policy "unit members read scores" on public.scale_scores for select to authenticated
using (exists (select 1 from public.scale_assessments a where a.id = assessment_id and public.is_member_of(a.unit_id)));
create policy "owner writes scores" on public.scale_scores for all to authenticated
using (exists (select 1 from public.scale_assessments a where a.id = assessment_id and public.is_member_of(a.unit_id) and (a.created_by = auth.uid() or public.is_manager())))
with check (exists (select 1 from public.scale_assessments a where a.id = assessment_id and public.is_member_of(a.unit_id) and (a.created_by = auth.uid() or public.is_manager())));

create policy "authenticated reads targets" on public.indicator_targets for select to authenticated using (true);
create policy "managers manage targets" on public.indicator_targets for all to authenticated
using (public.is_manager()) with check (public.is_manager());
create policy "managers read audit" on public.audit_logs for select to authenticated
using (public.is_manager());

create or replace view public.scale_assessment_totals
with (security_invoker = true) as
select
  a.id,
  a.unit_id,
  a.scale_type,
  a.patient_id,
  a.collaborator_id,
  a.assessment_date,
  a.moment,
  a.sector_id,
  a.attendance_number,
  coalesce(sum(o.points), 0)::integer as total,
  count(s.item_id)::integer as answered_items,
  count(i.id)::integer as expected_items,
  count(s.item_id) = count(i.id) as complete
from public.scale_assessments a
join public.scale_items i on i.scale_type = a.scale_type
left join public.scale_scores s on s.assessment_id = a.id and s.item_id = i.id
left join public.scale_item_options o on o.id = s.option_id
group by a.id;

create or replace view public.scale_assessment_results
with (security_invoker = true) as
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
  from public.scale_assessment_totals e
  where e.patient_id = t.patient_id
    and e.scale_type = t.scale_type
    and e.moment = 'entrada'
    and coalesce(e.attendance_number, '') = coalesce(t.attendance_number, '')
    and e.assessment_date <= t.assessment_date
  order by e.assessment_date desc
  limit 1
) previous on t.moment = 'saida';

create or replace view public.production_metrics
with (security_invoker = true) as
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
where v.record_id is not null or (i.derived and num.record_id is not null and den.record_id is not null);

create or replace view public.dashboard_scale_summary
with (security_invoker = true) as
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

create or replace function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
  values (
    tg_table_name,
    coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id'),
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_production_records after insert or update or delete on public.production_records
for each row execute function public.write_audit_log();
create trigger audit_scale_assessments after insert or update or delete on public.scale_assessments
for each row execute function public.write_audit_log();
create trigger audit_collaborators after insert or update or delete on public.collaborators
for each row execute function public.write_audit_log();
create trigger audit_indicator_targets after insert or update or delete on public.indicator_targets
for each row execute function public.write_audit_log();
create trigger audit_profiles after update on public.profiles
for each row execute function public.write_audit_log();

grant select on public.scale_assessment_totals to authenticated;
grant select on public.scale_assessment_results to authenticated;
grant select on public.production_metrics to authenticated;
grant select on public.dashboard_scale_summary to authenticated;

commit;
