-- P1 Codex: convite administrativo atômico, filtros completos do dashboard
-- e auditoria administrativa limitada à unidade ativa.

begin;

-- O usuário do Auth é criado fora da transação PostgreSQL. Toda a parte
-- relacional do convite fica nesta única função: perfil, unidade, colaborador
-- e unidade de atuação confirmam juntos ou são integralmente revertidos.
create or replace function public.admin_provision_invited_user(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_full_name text,
  p_role public.app_role,
  p_service_id uuid,
  p_unit_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role public.app_role;
  v_actor_service_id uuid;
  v_full_name text := trim(p_full_name);
  v_normalized_name text;
  v_collaborator_id uuid;
  v_collaborator_user_id uuid;
begin
  select role, service_id
    into v_actor_role, v_actor_service_id
  from public.profiles
  where user_id = p_actor_id and active;

  if not found or v_actor_role not in ('super_admin', 'admin', 'coordenador') then
    raise exception 'Usuário sem autoridade administrativa'
      using errcode = '42501';
  end if;

  if p_actor_id = p_target_user_id or p_role = 'super_admin' then
    raise exception 'Papel ou usuário de destino inválido'
      using errcode = '42501';
  end if;

  if char_length(v_full_name) < 2 or char_length(v_full_name) > 120 then
    raise exception 'Nome deve ter entre 2 e 120 caracteres'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.services where id = p_service_id and active
  ) then
    raise exception 'Serviço inválido ou inativo'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.units where id = p_unit_id and active
  ) then
    raise exception 'Unidade inválida ou inativa'
      using errcode = '22023';
  end if;

  if v_actor_role <> 'super_admin'
     and not exists (
       select 1
       from public.profile_units
       where user_id = p_actor_id and unit_id = p_unit_id
     ) then
    raise exception 'Unidade fora do escopo do gestor'
      using errcode = '42501';
  end if;

  if v_actor_role = 'coordenador'
     and (p_role <> 'colaborador' or p_service_id is distinct from v_actor_service_id) then
    raise exception 'Coordenador só convida colaboradores do próprio serviço'
      using errcode = '42501';
  end if;

  insert into public.profiles (
    user_id, full_name, role, service_id, active
  )
  values (
    p_target_user_id, v_full_name, p_role, p_service_id, true
  )
  on conflict (user_id) do update
  set full_name = excluded.full_name,
      role = excluded.role,
      service_id = excluded.service_id,
      active = true;

  insert into public.profile_units (user_id, unit_id)
  values (p_target_user_id, p_unit_id)
  on conflict do nothing;

  select id, user_id
    into v_collaborator_id, v_collaborator_user_id
  from public.collaborators
  where user_id = p_target_user_id;

  v_normalized_name := lower(regexp_replace(v_full_name, '\s+', ' ', 'g'));

  if v_collaborator_id is null then
    select id, user_id
      into v_collaborator_id, v_collaborator_user_id
    from public.collaborators
    where service_id = p_service_id
      and normalized_name = v_normalized_name;
  end if;

  if v_collaborator_id is not null
     and v_collaborator_user_id is not null
     and v_collaborator_user_id <> p_target_user_id then
    raise exception 'Profissional já vinculado a outro acesso'
      using errcode = '23505';
  end if;

  if v_collaborator_id is null then
    insert into public.collaborators (
      canonical_name, service_id, user_id, active
    )
    values (
      v_full_name, p_service_id, p_target_user_id, true
    )
    returning id into v_collaborator_id;
  else
    update public.collaborators
    set canonical_name = v_full_name,
        service_id = p_service_id,
        user_id = p_target_user_id,
        active = true
    where id = v_collaborator_id;
  end if;

  insert into public.collaborator_units (collaborator_id, unit_id)
  values (v_collaborator_id, p_unit_id)
  on conflict do nothing;

  return v_collaborator_id;
end;
$$;

revoke all on function public.admin_provision_invited_user(
  uuid, uuid, text, public.app_role, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.admin_provision_invited_user(
  uuid, uuid, text, public.app_role, uuid, uuid
) to service_role;

-- Sobrecarga usada pelo dashboard. A assinatura anterior de cinco argumentos
-- permanece disponível para relatórios e integrações existentes.
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
        join public.production_values num
          on num.record_id = r.id
         and num.indicator_id = i.numerator_indicator_id
        join public.production_values den
          on den.record_id = r.id
         and den.indicator_id = i.denominator_indicator_id
        where r.record_date between p_start and p_end
          and (p_unit is null or r.unit_id = p_unit)
          and (p_service is null or r.service_id = p_service)
          and (p_sector is null or r.sector_id = p_sector)
          and (p_shift is null or r.shift = p_shift)
          and (p_collaborator is null or r.collaborator_id = p_collaborator)
      )
      when i.kind = 'taxa' then (
        select round(avg(v.numeric_value), 2)
        from public.production_records r
        join public.production_values v
          on v.record_id = r.id and v.indicator_id = i.id
        where r.record_date between p_start and p_end
          and (p_unit is null or r.unit_id = p_unit)
          and (p_service is null or r.service_id = p_service)
          and (p_sector is null or r.sector_id = p_sector)
          and (p_shift is null or r.shift = p_shift)
          and (p_collaborator is null or r.collaborator_id = p_collaborator)
      )
      else (
        select sum(v.numeric_value)
        from public.production_records r
        join public.production_values v
          on v.record_id = r.id and v.indicator_id = i.id
        where r.record_date between p_start and p_end
          and (p_unit is null or r.unit_id = p_unit)
          and (p_service is null or r.service_id = p_service)
          and (p_sector is null or r.sector_id = p_sector)
          and (p_shift is null or r.shift = p_shift)
          and (p_collaborator is null or r.collaborator_id = p_collaborator)
      )
    end as total
  from public.indicators i
  where i.active;
$$;

revoke all on function public.production_metrics_totals(
  date, date, uuid, uuid, uuid, public.work_shift, uuid
) from public;
grant execute on function public.production_metrics_totals(
  date, date, uuid, uuid, uuid, public.work_shift, uuid
) to authenticated;

-- A tabela de auditoria contém eventos de várias unidades. Esta função devolve
-- os 100 eventos mais recentes que podem ser relacionados à unidade ativa.
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
security invoker
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
    (p_unit is null and public.is_super_admin())
    or (
      p_unit is not null
      and public.is_member_of(p_unit)
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
  order by a.changed_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;

revoke all on function public.admin_audit_logs(uuid, integer) from public;
grant execute on function public.admin_audit_logs(uuid, integer) to authenticated;

commit;
