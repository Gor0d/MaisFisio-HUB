-- Qualidade dos registros das escalas (19/11/2026): entradas sem saída e
-- saídas sem entrada, com o provável motivo, para a equipe corrigir.
--
-- Pareamento igual ao do B.I. (scale_bi / scale_assessment_results): mesmo
-- paciente, escala e número de atendimento.
--   * Entrada sem saída: nenhuma saída (em qualquer data) do mesmo paciente,
--     escala e atendimento a partir da data da entrada. Separadas em "em
--     aberto recente" (até p_open_days dias: o paciente pode ainda estar
--     internado) e "em aberto antiga" (provável saída não registrada).
--   * Saída sem entrada: nenhuma entrada completa anterior/igual à data da
--     saída. Motivo provável:
--       outro_atendimento  – há entrada do paciente nos 90 dias anteriores com
--                            outro número de atendimento (erro de digitação);
--       entrada_incompleta – a entrada existe, mas não está completa;
--       entrada_posterior  – a entrada foi registrada com data depois da saída;
--       sem_entrada        – nenhuma entrada encontrada.
--
-- Exclusivo de administrador e matriz, que também podem corrigir o registro
-- (admin_correct_scale_assessment): data, momento, atendimento, setor,
-- profissional ou exclusão, sempre com motivo. A correção fica na auditoria
-- (antes/depois) e o motivo é anexado às observações da avaliação.

begin;

create index if not exists scale_assessments_patient_moment_idx
  on public.scale_assessments (patient_id, scale_type, moment, assessment_date);

create or replace function public.scale_data_quality(
  p_scale public.scale_type,
  p_start date,
  p_end date,
  p_unit uuid default null,
  p_sector uuid default null,
  p_open_days integer default 30
)
returns jsonb
language sql stable security definer set search_path = public
as $$
  with allowed as (
    select coalesce((select public.current_app_role())::text, '') in ('super_admin', 'admin') and case
      when p_unit is null then coalesce((select public.is_super_admin()), false)
      else coalesce((select public.is_member_of(p_unit)), false)
    end as ok
  ),
  base as materialized (
    select a.id, a.sector_id, a.patient_id, coalesce(a.attendance_number, '') as att,
      a.attendance_number, a.assessment_date, a.moment, a.complete
    from public.scale_assessments a
    where (select ok from allowed)
      and a.scale_type = p_scale
      and a.assessment_date between p_start and p_end
      and (p_unit is null or a.unit_id = p_unit)
      and (p_sector is null or a.sector_id = p_sector)
  ),
  entries as materialized (
    select e.*, (current_date - e.assessment_date) as dias,
      exists (
        select 1 from public.scale_assessments x
        where x.patient_id = e.patient_id and x.scale_type = p_scale and x.moment = 'saida'
          and coalesce(x.attendance_number, '') = e.att and x.assessment_date >= e.assessment_date
      ) as has_exit
    from base e where e.moment = 'entrada' and e.complete
  ),
  open_entries as materialized (
    select *, case when dias <= p_open_days then 'recente' else 'antiga' end as situacao
    from entries where not has_exit
  ),
  exits as materialized (
    select s.*,
      exists (
        select 1 from public.scale_assessments x
        where x.patient_id = s.patient_id and x.scale_type = p_scale and x.moment = 'entrada' and x.complete
          and coalesce(x.attendance_number, '') = s.att and x.assessment_date <= s.assessment_date
      ) as has_entry
    from base s where s.moment = 'saida' and s.complete
  ),
  orphan_exits as materialized (
    select s.*,
      other.assessment_date as outra_data, other.attendance_number as outro_atendimento,
      case
        when exists (select 1 from public.scale_assessments x
          where x.patient_id = s.patient_id and x.scale_type = p_scale and x.moment = 'entrada'
            and coalesce(x.attendance_number, '') = s.att and x.assessment_date <= s.assessment_date and not x.complete)
          then 'entrada_incompleta'
        when other.assessment_date is not null then 'outro_atendimento'
        when exists (select 1 from public.scale_assessments x
          where x.patient_id = s.patient_id and x.scale_type = p_scale and x.moment = 'entrada'
            and coalesce(x.attendance_number, '') = s.att and x.assessment_date > s.assessment_date)
          then 'entrada_posterior'
        else 'sem_entrada'
      end as motivo
    from exits s
    left join lateral (
      select x.assessment_date, x.attendance_number
      from public.scale_assessments x
      where x.patient_id = s.patient_id and x.scale_type = p_scale and x.moment = 'entrada'
        and coalesce(x.attendance_number, '') <> s.att
        and x.assessment_date between s.assessment_date - 90 and s.assessment_date
      order by x.assessment_date desc limit 1
    ) other on true
    where not s.has_entry
  ),
  months as (
    select to_char(date_trunc('month', assessment_date), 'YYYY-MM') as mes,
      count(*) filter (where moment = 'entrada' and complete) as entradas,
      count(*) filter (where moment = 'saida' and complete) as saidas
    from base group by 1
  )
  select jsonb_build_object(
    'resumo', jsonb_build_object(
      'entradas', (select count(*) from entries),
      'entradas_sem_saida', (select count(*) from open_entries),
      'em_aberto_recente', (select count(*) from open_entries where situacao = 'recente'),
      'em_aberto_antiga', (select count(*) from open_entries where situacao = 'antiga'),
      'saidas', (select count(*) from exits),
      'saidas_sem_entrada', (select count(*) from orphan_exits),
      'motivos', coalesce((select jsonb_object_agg(motivo, n) from (select motivo, count(*) as n from orphan_exits group by 1) m), '{}'::jsonb),
      'dias_limite', p_open_days
    ),
    'mensal', coalesce((
      select jsonb_agg(jsonb_build_object(
        'mes', m.mes, 'entradas', m.entradas, 'saidas', m.saidas,
        'entradas_sem_saida', (select count(*) from open_entries o where to_char(o.assessment_date, 'YYYY-MM') = m.mes),
        'em_aberto_antiga', (select count(*) from open_entries o where o.situacao = 'antiga' and to_char(o.assessment_date, 'YYYY-MM') = m.mes),
        'saidas_sem_entrada', (select count(*) from orphan_exits o where to_char(o.assessment_date, 'YYYY-MM') = m.mes)
      ) order by m.mes)
      from months m
    ), '[]'::jsonb),
    'setores', coalesce((
      select jsonb_agg(x order by x.total desc, x.setor) from (
        select jsonb_build_object(
          'setor', coalesce(sec.name, 'Sem setor'),
          'entradas_sem_saida', count(*) filter (where t.kind = 'e'),
          'em_aberto_antiga', count(*) filter (where t.kind = 'e' and t.antiga),
          'saidas_sem_entrada', count(*) filter (where t.kind = 's')
        ) as x, count(*) as total, coalesce(sec.name, 'Sem setor') as setor
        from (
          select sector_id, 'e' as kind, situacao = 'antiga' as antiga from open_entries
          union all select sector_id, 's', false from orphan_exits
        ) t left join public.sectors sec on sec.id = t.sector_id
        group by sec.name
      ) x
    ), '[]'::jsonb),
    'entradas_pendentes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'data', o.assessment_date, 'iniciais', p.initials, 'prontuario', p.record_number,
        'atendimento', o.attendance_number, 'setor_id', o.sector_id, 'setor', sec.name, 'dias', o.dias, 'situacao', o.situacao
      ) order by o.dias desc, o.assessment_date)
      from (select * from open_entries order by dias desc limit 500) o
      join public.patients p on p.id = o.patient_id
      left join public.sectors sec on sec.id = o.sector_id
    ), '[]'::jsonb),
    'saidas_pendentes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'data', o.assessment_date, 'iniciais', p.initials, 'prontuario', p.record_number,
        'atendimento', o.attendance_number, 'setor_id', o.sector_id, 'setor', sec.name, 'motivo', o.motivo,
        'outro_atendimento', o.outro_atendimento, 'outra_data', o.outra_data
      ) order by o.assessment_date desc)
      from (select * from orphan_exits order by assessment_date desc limit 500) o
      join public.patients p on p.id = o.patient_id
      left join public.sectors sec on sec.id = o.sector_id
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.scale_data_quality(public.scale_type, date, date, uuid, uuid, integer) from public, anon;
grant execute on function public.scale_data_quality(public.scale_type, date, date, uuid, uuid, integer) to authenticated;

-- Correção pelo administrador (erro operacional). p_changes aceita
-- assessment_date, moment, attendance_number, sector_id, collaborator_id ou
-- {"delete": true}. As validações da tabela continuam valendo (data futura,
-- setor da mesma unidade, avaliação duplicada).
create or replace function public.admin_correct_scale_assessment(p_id uuid, p_changes jsonb, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  a public.scale_assessments;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_note text;
begin
  select * into a from public.scale_assessments where id = p_id;
  if not found then
    raise exception 'Avaliação não encontrada';
  end if;
  if coalesce(public.current_app_role()::text, '') not in ('super_admin', 'admin') or not public.is_member_of(a.unit_id) then
    raise exception 'Somente o administrador da unidade pode corrigir avaliações' using errcode = '42501';
  end if;
  if v_reason is null or char_length(v_reason) < 5 then
    raise exception 'Informe o motivo da correção (mínimo 5 caracteres)';
  end if;

  v_note := format('[Correção em %s por %s: %s]',
    to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'),
    coalesce((select full_name from public.profiles where user_id = auth.uid()), 'administrador'),
    left(v_reason, 300));

  if coalesce((p_changes ->> 'delete')::boolean, false) then
    -- Registra o motivo (fica no "antes" da exclusão na auditoria) e exclui.
    update public.scale_assessments set notes = right(concat_ws(chr(10), notes, v_note), 2000) where id = p_id;
    delete from public.scale_assessments where id = p_id;
    return;
  end if;

  update public.scale_assessments set
    assessment_date = coalesce((p_changes ->> 'assessment_date')::date, assessment_date),
    moment = coalesce((p_changes ->> 'moment')::public.assessment_moment, moment),
    attendance_number = case when p_changes ? 'attendance_number' then nullif(trim(p_changes ->> 'attendance_number'), '') else attendance_number end,
    sector_id = coalesce((p_changes ->> 'sector_id')::uuid, sector_id),
    collaborator_id = case when p_changes ? 'collaborator_id' then nullif(p_changes ->> 'collaborator_id', '')::uuid else collaborator_id end,
    notes = right(concat_ws(chr(10), notes, v_note), 2000)
  where id = p_id;
end;
$$;

revoke all on function public.admin_correct_scale_assessment(uuid, jsonb, text) from public, anon;
grant execute on function public.admin_correct_scale_assessment(uuid, jsonb, text) to authenticated;

commit;
