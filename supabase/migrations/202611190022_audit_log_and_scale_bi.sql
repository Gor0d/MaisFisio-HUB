-- Log de auditoria completo e B.I. das escalas clínicas (19/11/2026).
--
-- Auditoria:
--   * audit_logs.unit_id gravado pelo gatilho (antes a tela procurava a
--     unidade dentro do JSON de cada linha, sem índice);
--   * mais tabelas auditadas: unidades, setores, catálogo de indicadores,
--     vínculos de setor/serviço, acesso de usuários e colaboradores às unidades
--     e criação/exclusão de perfis;
--   * audit_log_search: busca paginada com filtros (período, entidade, ação,
--     responsável, origem), devolvendo antes/depois para a tela mostrar o que
--     mudou;
--   * audit_access_log: entradas, saídas e trocas de senha registradas pelo
--     serviço de autenticação (auth.audit_log_entries).
--
-- Acesso: a auditoria é exclusiva de administrador e matriz (coordenador não
-- vê mais a trilha nem pela API).
--
-- Escalas: scale_bi devolve, numa ida ao banco, os indicadores de uma escala
-- no período (volumes, pares entrada/saída, melhora, médias, por mês, por
-- setor, por item, distribuição de totais e transições).
--
-- Mesma técnica das migrações 020/021: security definer com a regra de acesso
-- aplicada explicitamente, calculada uma vez por consulta.

begin;

-- 1) Unidade da linha de auditoria -------------------------------------------
alter table public.audit_logs add column if not exists unit_id uuid;

update public.audit_logs
set unit_id = (case
  when table_name = 'units' then coalesce(new_data ->> 'id', old_data ->> 'id')
  else coalesce(new_data ->> 'unit_id', old_data ->> 'unit_id')
end)::uuid
where unit_id is null;

create index if not exists audit_logs_unit_changed_idx on public.audit_logs (unit_id, changed_at desc);

create or replace function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  technical_only boolean := false;
  d jsonb := to_jsonb(coalesce(new, old));
  v_unit uuid;
begin
  -- UPDATE técnico de totais da escala (ver 202608030016): não é edição real.
  if tg_op = 'UPDATE' and tg_table_name = 'scale_assessments' then
    technical_only := (to_jsonb(old) - 'total' - 'answered_items' - 'expected_items' - 'complete' - 'updated_at')
                     = (to_jsonb(new) - 'total' - 'answered_items' - 'expected_items' - 'complete' - 'updated_at');
  end if;
  if technical_only then
    return coalesce(new, old);
  end if;

  v_unit := case
    when tg_table_name = 'units' then (d ->> 'id')::uuid
    when d ? 'unit_id' then (d ->> 'unit_id')::uuid
    when tg_table_name = 'service_sectors' then (select s.unit_id from public.sectors s where s.id = (d ->> 'sector_id')::uuid)
  end;

  insert into public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by, unit_id)
  values (
    tg_table_name,
    -- Tabelas de vínculo não têm id: registra o "dono" do vínculo.
    coalesce(d ->> 'id', d ->> 'user_id', d ->> 'collaborator_id', d ->> 'sector_id'),
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    auth.uid(),
    v_unit
  );
  return coalesce(new, old);
end;
$$;

-- Leitura da trilha: só administrador e matriz.
drop policy if exists "managers read audit" on public.audit_logs;
drop policy if exists "admins read audit" on public.audit_logs;
create policy "admins read audit" on public.audit_logs for select to authenticated
using ((select public.current_app_role()) in ('super_admin', 'admin'));
-- Função antiga (aba da Administração): substituída por audit_log_search.
revoke execute on function public.admin_audit_logs(uuid, integer) from authenticated;

-- 2) Mais tabelas auditadas --------------------------------------------------
drop trigger if exists audit_units on public.units;
create trigger audit_units after insert or update or delete on public.units
  for each row execute function public.write_audit_log();
drop trigger if exists audit_sectors on public.sectors;
create trigger audit_sectors after insert or update or delete on public.sectors
  for each row execute function public.write_audit_log();
drop trigger if exists audit_indicators on public.indicators;
create trigger audit_indicators after insert or update or delete on public.indicators
  for each row execute function public.write_audit_log();
drop trigger if exists audit_service_sectors on public.service_sectors;
create trigger audit_service_sectors after insert or delete on public.service_sectors
  for each row execute function public.write_audit_log();
drop trigger if exists audit_profile_units on public.profile_units;
create trigger audit_profile_units after insert or delete on public.profile_units
  for each row execute function public.write_audit_log();
drop trigger if exists audit_collaborator_units on public.collaborator_units;
create trigger audit_collaborator_units after insert or delete on public.collaborator_units
  for each row execute function public.write_audit_log();
drop trigger if exists audit_profiles on public.profiles;
create trigger audit_profiles after insert or update or delete on public.profiles
  for each row execute function public.write_audit_log();

-- 3) Busca na trilha de alterações -------------------------------------------
create or replace function public.audit_log_search(
  p_unit uuid,
  p_start date,
  p_end date,
  p_tables text[] default null,
  p_actions text[] default null,
  p_actor uuid default null,
  p_origin text default 'todos',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id bigint,
  changed_at timestamptz,
  action text,
  table_name text,
  record_id text,
  unit_id uuid,
  changed_by uuid,
  changed_by_name text,
  old_data jsonb,
  new_data jsonb,
  total_count bigint
)
language sql stable security definer set search_path = public
as $$
  select
    a.id, a.changed_at, a.action, a.table_name, a.record_id, a.unit_id,
    a.changed_by, actor.full_name, a.old_data, a.new_data,
    count(*) over ()
  from public.audit_logs a
  left join public.profiles actor on actor.user_id = a.changed_by
  where (select public.current_app_role()) in ('super_admin', 'admin')
    and a.changed_at >= (p_start::timestamp at time zone 'America/Sao_Paulo')
    and a.changed_at < ((p_end + 1)::timestamp at time zone 'America/Sao_Paulo')
    and (coalesce(cardinality(p_tables), 0) = 0 or a.table_name = any (p_tables))
    and (coalesce(cardinality(p_actions), 0) = 0 or a.action = any (p_actions))
    and (p_actor is null or a.changed_by = p_actor)
    and (coalesce(p_origin, 'todos') = 'todos'
      or (p_origin = 'usuarios' and a.changed_by is not null)
      or (p_origin = 'sistema' and a.changed_by is null))
    and (
      (p_unit is null and (select public.is_super_admin()))
      or (
        p_unit is not null
        and (select public.is_member_of(p_unit))
        and (
          a.unit_id = p_unit
          or (a.unit_id is null and a.table_name = 'collaborators' and exists (
            select 1 from public.collaborator_units cu
            where cu.collaborator_id::text = a.record_id and cu.unit_id = p_unit))
          or (a.unit_id is null and a.table_name = 'profiles' and exists (
            select 1 from public.profile_units pu
            where pu.user_id::text = a.record_id and pu.unit_id = p_unit))
          -- Catálogo global (indicadores): só a matriz enxerga.
          or (a.unit_id is null and a.table_name = 'indicators' and (select public.is_super_admin()))
        )
      )
    )
  order by a.changed_at desc, a.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 5000)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.audit_log_search(uuid, date, date, text[], text[], uuid, text, integer, integer) from public, anon;
grant execute on function public.audit_log_search(uuid, date, date, text[], text[], uuid, text, integer, integer) to authenticated;

-- 4) Acessos (login, logout, senha) ------------------------------------------
create or replace function public.audit_access_log(
  p_unit uuid,
  p_start date,
  p_end date,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  created_at timestamptz,
  action text,
  user_id uuid,
  user_name text,
  email text,
  ip_address text,
  total_count bigint
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if coalesce((select public.current_app_role())::text, '') not in ('super_admin', 'admin') then return; end if;
  if p_unit is null and not coalesce(public.is_super_admin(), false) then return; end if;
  if p_unit is not null and not coalesce(public.is_member_of(p_unit), false) then return; end if;
  -- Ambientes sem o serviço de autenticação (ex.: testes) não têm a tabela.
  if to_regclass('auth.audit_log_entries') is null then return; end if;

  return query execute $q$
    select e.id, e.created_at, e.payload ->> 'action', p.user_id, p.full_name,
      coalesce(e.payload ->> 'actor_username', e.payload -> 'traits' ->> 'user_email'),
      nullif(e.ip_address, '')::text,
      count(*) over ()
    from auth.audit_log_entries e
    left join public.profiles p on p.user_id::text = e.payload ->> 'actor_id'
    where e.created_at >= ($2::timestamp at time zone 'America/Sao_Paulo')
      and e.created_at < (($3 + 1)::timestamp at time zone 'America/Sao_Paulo')
      and coalesce(e.payload ->> 'action', '') not in ('token_refreshed', 'token_revoked')
      and ($1 is null or exists (
        select 1 from public.profile_units pu
        where pu.user_id = p.user_id and pu.unit_id = $1))
    order by e.created_at desc
    limit least(greatest(coalesce($4, 50), 1), 5000)
    offset greatest(coalesce($5, 0), 0)
  $q$ using p_unit, p_start, p_end, p_limit, p_offset;
end;
$$;

revoke all on function public.audit_access_log(uuid, date, date, integer, integer) from public, anon;
grant execute on function public.audit_access_log(uuid, date, date, integer, integer) to authenticated;

-- 5) B.I. das escalas --------------------------------------------------------
-- Pareamento igual ao de scale_assessment_results: a saída é comparada com a
-- última entrada (mesmo paciente, escala e atendimento) até a data da saída;
-- só conta quando as duas avaliações estão completas.
create or replace function public.scale_bi(
  p_scale public.scale_type,
  p_start date,
  p_end date,
  p_unit uuid default null,
  p_sector uuid default null
)
returns jsonb
language sql stable security definer set search_path = public
as $$
  with allowed as (
    select case
      when p_unit is null then coalesce((select public.is_super_admin()), false)
      else coalesce((select public.is_member_of(p_unit)), false)
    end as ok
  ),
  base as materialized (
    select a.id, a.unit_id, a.sector_id, a.collaborator_id, a.patient_id,
      a.attendance_number, a.assessment_date, a.moment, a.total, a.complete
    from public.scale_assessments a
    where (select ok from allowed)
      and a.scale_type = p_scale
      and a.assessment_date between p_start and p_end
      and (p_unit is null or a.unit_id = p_unit)
      and (p_sector is null or a.sector_id = p_sector)
  ),
  done as materialized (select * from base where complete),
  pairs as materialized (
    select s.id, s.sector_id, s.assessment_date, s.total as exit_total,
      e.total as entry_total, e.assessment_date as entry_date
    from done s
    join lateral (
      select x.total, x.assessment_date, x.complete
      from public.scale_assessments x
      where x.patient_id = s.patient_id
        and x.scale_type = p_scale
        and x.moment = 'entrada'
        and coalesce(x.attendance_number, '') = coalesce(s.attendance_number, '')
        and x.assessment_date <= s.assessment_date
      order by x.assessment_date desc
      limit 1
    ) e on e.complete
    where s.moment = 'saida'
  ),
  monthly as (
    select to_char(date_trunc('month', assessment_date), 'YYYY-MM') as mes,
      count(*) filter (where moment = 'entrada') as entradas,
      count(*) filter (where moment = 'saida') as saidas,
      round(avg(total) filter (where moment = 'entrada'), 2) as media_entrada,
      round(avg(total) filter (where moment = 'saida'), 2) as media_saida
    from done group by 1
  ),
  monthly_pairs as (
    select to_char(date_trunc('month', assessment_date), 'YYYY-MM') as mes,
      count(*) as pares,
      count(*) filter (where exit_total > entry_total) as melhoraram,
      round(avg(exit_total - entry_total), 2) as ganho_medio
    from pairs group by 1
  ),
  by_sector as (
    select sector_id,
      count(*) filter (where moment = 'entrada') as entradas,
      count(*) filter (where moment = 'saida') as saidas,
      round(avg(total) filter (where moment = 'entrada'), 2) as media_entrada,
      round(avg(total) filter (where moment = 'saida'), 2) as media_saida
    from done group by 1
  ),
  sector_pairs as (
    select sector_id, count(*) as pares,
      count(*) filter (where exit_total > entry_total) as melhoraram,
      round(avg(exit_total - entry_total), 2) as ganho_medio,
      round(avg(assessment_date - entry_date), 1) as permanencia_media
    from pairs group by 1
  ),
  items as (
    select sc.item_id,
      round(avg(o.points) filter (where d.moment = 'entrada'), 2) as media_entrada,
      round(avg(o.points) filter (where d.moment = 'saida'), 2) as media_saida
    from done d
    join public.scale_scores sc on sc.assessment_id = d.id
    join public.scale_item_options o on o.id = sc.option_id
    group by 1
  )
  select jsonb_build_object(
    'kpis', jsonb_build_object(
      'avaliacoes', (select count(*) from base),
      'incompletas', (select count(*) from base where not complete),
      'entradas', (select count(*) from done where moment = 'entrada'),
      'saidas', (select count(*) from done where moment = 'saida'),
      'pacientes', (select count(distinct patient_id) from done),
      'pares', (select count(*) from pairs),
      'melhoraram', (select count(*) from pairs where exit_total > entry_total),
      'mantiveram', (select count(*) from pairs where exit_total = entry_total),
      'pioraram', (select count(*) from pairs where exit_total < entry_total),
      'media_entrada', (select round(avg(total), 2) from done where moment = 'entrada'),
      'media_saida', (select round(avg(total), 2) from done where moment = 'saida'),
      'ganho_medio', (select round(avg(exit_total - entry_total), 2) from pairs),
      'permanencia_media', (select round(avg(assessment_date - entry_date), 1) from pairs)
    ),
    'mensal', coalesce((
      select jsonb_agg(jsonb_build_object(
        'mes', m.mes, 'entradas', m.entradas, 'saidas', m.saidas,
        'media_entrada', m.media_entrada, 'media_saida', m.media_saida,
        'pares', coalesce(p.pares, 0), 'melhoraram', coalesce(p.melhoraram, 0),
        'ganho_medio', p.ganho_medio) order by m.mes)
      from monthly m left join monthly_pairs p using (mes)
    ), '[]'::jsonb),
    'setores', coalesce((
      select jsonb_agg(jsonb_build_object(
        'setor', coalesce(s.name, 'Sem setor'), 'entradas', b.entradas, 'saidas', b.saidas,
        'media_entrada', b.media_entrada, 'media_saida', b.media_saida,
        'pares', coalesce(p.pares, 0), 'melhoraram', coalesce(p.melhoraram, 0),
        'ganho_medio', p.ganho_medio, 'permanencia_media', p.permanencia_media)
        order by b.entradas + b.saidas desc, s.name)
      from by_sector b
      left join sector_pairs p using (sector_id)
      left join public.sectors s on s.id = b.sector_id
    ), '[]'::jsonb),
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item', i.name, 'max', i.max_points,
        'media_entrada', x.media_entrada, 'media_saida', x.media_saida)
        order by i.display_order)
      from public.scale_items i
      left join items x on x.item_id = i.id
      where i.scale_type = p_scale
    ), '[]'::jsonb),
    'histograma', coalesce((
      select jsonb_agg(jsonb_build_object('momento', h.moment, 'total', h.total, 'n', h.n) order by h.moment, h.total)
      from (select moment, total, count(*) as n from done group by 1, 2) h
    ), '[]'::jsonb),
    'transicoes', coalesce((
      select jsonb_agg(jsonb_build_object('entrada', t.entry_total, 'saida', t.exit_total, 'n', t.n))
      from (select entry_total, exit_total, count(*) as n from pairs group by 1, 2) t
    ), '[]'::jsonb),
    'colaboradores', coalesce((
      select jsonb_agg(jsonb_build_object('nome', c.nome, 'avaliacoes', c.n, 'entradas', c.entradas, 'saidas', c.saidas) order by c.n desc, c.nome)
      from (
        select coalesce(col.canonical_name, 'Não informado') as nome, count(*) as n,
          count(*) filter (where d.moment = 'entrada') as entradas,
          count(*) filter (where d.moment = 'saida') as saidas
        from done d left join public.collaborators col on col.id = d.collaborator_id
        group by 1 order by 2 desc limit 20
      ) c
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.scale_bi(public.scale_type, date, date, uuid, uuid) from public, anon;
grant execute on function public.scale_bi(public.scale_type, date, date, uuid, uuid) to authenticated;

commit;
