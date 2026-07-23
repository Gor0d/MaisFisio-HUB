-- P1: cadastro atômico de setor com os serviços habilitados.
-- A função concentra autorização e consistência no banco; a interface não
-- precisa criar o setor e seus vínculos em operações independentes.

begin;

create or replace function public.save_sector_with_services(
  p_sector_id uuid,
  p_unit_id uuid,
  p_name text,
  p_context text,
  p_service_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sector_id uuid;
  v_existing_unit uuid;
  v_name text := trim(p_name);
  v_code text;
  v_base_code text;
  v_suffix integer := 1;
  v_service_ids uuid[];
begin
  if not coalesce(public.current_app_role() in ('super_admin', 'admin'), false) then
    raise exception 'Apenas administradores podem gerenciar setores'
      using errcode = '42501';
  end if;

  if p_unit_id is null or not public.is_member_of(p_unit_id) then
    raise exception 'Unidade fora do seu escopo de acesso'
      using errcode = '42501';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Nome do setor deve ter entre 2 e 120 caracteres'
      using errcode = '22023';
  end if;

  if p_context not in ('uti', 'enfermaria', 'clinica', 'ambulatorio') then
    raise exception 'Contexto de setor inválido'
      using errcode = '22023';
  end if;

  select array_agg(distinct s.id order by s.id)
    into v_service_ids
  from public.services s
  where s.active
    and s.id = any(coalesce(p_service_ids, '{}'::uuid[]));

  if coalesce(cardinality(v_service_ids), 0) = 0
     or cardinality(v_service_ids) <> (
       select count(distinct requested_id)
       from unnest(coalesce(p_service_ids, '{}'::uuid[])) requested_id
     ) then
    raise exception 'Selecione ao menos um serviço ativo válido'
      using errcode = '22023';
  end if;

  if p_sector_id is null then
    v_base_code := trim(both '_' from regexp_replace(
      lower(translate(
        v_name,
        'áàâãäéèêëíìîïóòôõöúùûüç',
        'aaaaaeeeeiiiiooooouuuuc'
      )),
      '[^a-z0-9]+',
      '_',
      'g'
    ));

    if v_base_code = '' then
      raise exception 'Nome do setor não gera um código válido'
        using errcode = '22023';
    end if;

    v_code := v_base_code;
    while exists (
      select 1 from public.sectors
      where unit_id = p_unit_id and code = v_code
    ) loop
      v_suffix := v_suffix + 1;
      v_code := v_base_code || '_' || v_suffix::text;
    end loop;

    insert into public.sectors (unit_id, code, name, context)
    values (p_unit_id, v_code, v_name, p_context)
    returning id into v_sector_id;
  else
    select unit_id
      into v_existing_unit
    from public.sectors
    where id = p_sector_id;

    if not found then
      raise exception 'Setor não encontrado'
        using errcode = 'P0002';
    end if;

    if v_existing_unit <> p_unit_id then
      raise exception 'A unidade do setor não pode ser alterada'
        using errcode = '22023';
    end if;

    update public.sectors
    set name = v_name,
        context = p_context
    where id = p_sector_id;

    v_sector_id := p_sector_id;
  end if;

  delete from public.service_sectors
  where sector_id = v_sector_id;

  insert into public.service_sectors (service_id, sector_id)
  select service_id, v_sector_id
  from unnest(v_service_ids) service_id;

  return v_sector_id;
end;
$$;

revoke all on function public.save_sector_with_services(uuid, uuid, text, text, uuid[]) from public;
grant execute on function public.save_sector_with_services(uuid, uuid, text, text, uuid[]) to authenticated;

commit;
