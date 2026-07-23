-- P1: atualização atômica de perfil, papel, serviço e vínculos de unidade.
-- A função só pode ser chamada pela service_role e repete no banco todas as
-- verificações de autoridade feitas pela rota administrativa.

begin;

create or replace function public.admin_update_user_access(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_full_name text,
  p_role public.app_role,
  p_service_id uuid,
  p_active boolean,
  p_unit_ids uuid[],
  p_collaborator_unit_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role public.app_role;
  v_actor_service_id uuid;
  v_target_role public.app_role;
  v_target_service_id uuid;
  v_full_name text := trim(p_full_name);
  v_unit_ids uuid[];
  v_collaborator_unit_ids uuid[];
  v_actor_unit_ids uuid[];
  v_collaborator_id uuid;
begin
  select role, service_id
    into v_actor_role, v_actor_service_id
  from public.profiles
  where user_id = p_actor_id and active;

  if not found or v_actor_role not in ('super_admin', 'admin', 'coordenador') then
    raise exception 'Usuário sem autoridade administrativa'
      using errcode = '42501';
  end if;

  if p_actor_id = p_target_user_id then
    raise exception 'O próprio acesso não pode ser alterado por esta tela'
      using errcode = '42501';
  end if;

  select role, service_id
    into v_target_role, v_target_service_id
  from public.profiles
  where user_id = p_target_user_id;

  if not found then
    raise exception 'Usuário não encontrado'
      using errcode = 'P0002';
  end if;

  if v_target_role = 'super_admin' or p_role = 'super_admin' then
    raise exception 'Contas da matriz não podem ser alteradas por esta tela'
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

  select coalesce(array_agg(distinct unit_id order by unit_id), '{}'::uuid[])
    into v_unit_ids
  from unnest(coalesce(p_unit_ids, '{}'::uuid[])) unit_id;

  select coalesce(array_agg(distinct unit_id order by unit_id), '{}'::uuid[])
    into v_collaborator_unit_ids
  from unnest(coalesce(p_collaborator_unit_ids, '{}'::uuid[])) unit_id;

  if cardinality(v_unit_ids) = 0 or cardinality(v_collaborator_unit_ids) = 0 then
    raise exception 'Selecione ao menos uma unidade de acesso e de atuação'
      using errcode = '22023';
  end if;

  if (
    select count(*) from public.units
    where active and id = any(v_unit_ids)
  ) <> cardinality(v_unit_ids)
  or (
    select count(*) from public.units
    where active and id = any(v_collaborator_unit_ids)
  ) <> cardinality(v_collaborator_unit_ids) then
    raise exception 'Uma das unidades selecionadas é inválida ou inativa'
      using errcode = '22023';
  end if;

  select coalesce(array_agg(unit_id order by unit_id), '{}'::uuid[])
    into v_actor_unit_ids
  from public.profile_units
  where user_id = p_actor_id;

  if v_actor_role = 'admin' then
    if not exists (
      select 1
      from public.profile_units actor_unit
      join public.profile_units target_unit using (unit_id)
      where actor_unit.user_id = p_actor_id
        and target_unit.user_id = p_target_user_id
    ) then
      raise exception 'Usuário fora do escopo do administrador'
        using errcode = '42501';
    end if;

    if exists (
      select 1 from unnest(v_unit_ids || v_collaborator_unit_ids) requested_unit
      where requested_unit <> all(v_actor_unit_ids)
    ) then
      raise exception 'Unidade fora do escopo do administrador'
        using errcode = '42501';
    end if;
  elsif v_actor_role = 'coordenador' then
    if v_target_role <> 'colaborador'
       or p_role <> 'colaborador'
       or v_target_service_id is distinct from v_actor_service_id
       or p_service_id is distinct from v_actor_service_id then
      raise exception 'Coordenador só gerencia colaboradores do próprio serviço'
        using errcode = '42501';
    end if;

    if not exists (
      select 1
      from public.profile_units actor_unit
      join public.profile_units target_unit using (unit_id)
      where actor_unit.user_id = p_actor_id
        and target_unit.user_id = p_target_user_id
    ) then
      raise exception 'Usuário fora do escopo do coordenador'
        using errcode = '42501';
    end if;

    if exists (
      select 1 from unnest(v_unit_ids || v_collaborator_unit_ids) requested_unit
      where requested_unit <> all(v_actor_unit_ids)
    ) then
      raise exception 'Unidade fora do escopo do coordenador'
        using errcode = '42501';
    end if;
  end if;

  update public.profiles
  set full_name = v_full_name,
      role = p_role,
      service_id = p_service_id,
      active = p_active
  where user_id = p_target_user_id;

  delete from public.profile_units
  where user_id = p_target_user_id;

  insert into public.profile_units (user_id, unit_id)
  select p_target_user_id, unit_id
  from unnest(v_unit_ids) unit_id;

  select id
    into v_collaborator_id
  from public.collaborators
  where user_id = p_target_user_id;

  if v_collaborator_id is null then
    insert into public.collaborators (
      canonical_name, service_id, user_id, active
    )
    values (
      v_full_name, p_service_id, p_target_user_id, p_active
    )
    returning id into v_collaborator_id;
  else
    update public.collaborators
    set canonical_name = v_full_name,
        service_id = p_service_id,
        active = p_active
    where id = v_collaborator_id;
  end if;

  delete from public.collaborator_units
  where collaborator_id = v_collaborator_id;

  insert into public.collaborator_units (collaborator_id, unit_id)
  select v_collaborator_id, unit_id
  from unnest(v_collaborator_unit_ids) unit_id;
end;
$$;

revoke all on function public.admin_update_user_access(
  uuid, uuid, text, public.app_role, uuid, boolean, uuid[], uuid[]
) from public;
grant execute on function public.admin_update_user_access(
  uuid, uuid, text, public.app_role, uuid, boolean, uuid[], uuid[]
) to service_role;

commit;
