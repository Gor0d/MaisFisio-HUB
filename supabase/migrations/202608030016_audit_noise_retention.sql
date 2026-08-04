begin;

-- Problema: scale_scores_refresh_totals (202607200005) faz um UPDATE em
-- scale_assessments a cada item de escala gravado (10 para Barthel, 12 para
-- MRC, 4 para Melhoria UTI), só para recalcular total/answered_items/
-- expected_items/complete. audit_scale_assessments capturava cada um desses
-- UPDATEs técnicos como se fosse uma edição real, gerando 10-12 linhas de
-- auditoria por avaliação clínica preenchida (a maior parte das 250 mil+
-- linhas hoje em audit_logs).
--
-- Fix: write_audit_log() agora ignora UPDATEs em scale_assessments quando a
-- única diferença entre old e new são as colunas derivadas (+ updated_at, que
-- muda em todo UPDATE via set_updated_at). Qualquer edição real de verdade
-- (setor, paciente, momento, notas etc.) continua sendo auditada normalmente,
-- porque nesse caso a comparação vai divergir em algum outro campo.
create or replace function public.write_audit_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  technical_only boolean := false;
begin
  if tg_op = 'UPDATE' and tg_table_name = 'scale_assessments' then
    technical_only := (to_jsonb(old) - 'total' - 'answered_items' - 'expected_items' - 'complete' - 'updated_at')
                     = (to_jsonb(new) - 'total' - 'answered_items' - 'expected_items' - 'complete' - 'updated_at');
  end if;

  if technical_only then
    return coalesce(new, old);
  end if;

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

-- Diferenciação ação do usuário x importação: já existe sem código novo.
-- changed_by fica null quando a escrita vem da service_role (script de
-- importação histórica, scripts/import-xlsx.ts, que faz upsert direto nas
-- tabelas sem passar pelas RPCs save_production_record/save_scale_assessment)
-- — ações reais de usuário sempre passam pela RPC autenticada e carregam
-- auth.uid(). Não precisa de coluna nova, só documentar a leitura correta.
comment on column public.audit_logs.changed_by is
  'Null indica escrita via service_role (ex.: importação histórica); ação de usuário real sempre tem auth.uid() aqui.';

-- Retenção: mantém 12 meses de auditoria (janela usada nas apurações
-- assistenciais/administrativas), depois descarta. Reduz LGPD-risk de reter
-- indefinidamente old_data/new_data de tabelas ligadas a pacientes.
create or replace function public.purge_old_audit_logs(p_retention_months integer default 12)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.audit_logs
  where changed_at < now() - (p_retention_months || ' months')::interval;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_old_audit_logs(integer) from public, anon, authenticated;

-- pg_cron não existe no PGlite usado pela suíte local (tests/rls.integration.test.ts
-- aplica todas as migrações do zero) nem em todo ambiente Postgres — condicional
-- para a migração continuar valendo como fixture de teste sem exigir a extensão.
-- Em produção (Supabase), pg_cron está disponível e o job é agendado normalmente.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron with schema pg_catalog';
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-audit-logs';
    perform cron.schedule('purge-audit-logs', '30 3 * * 0', 'select public.purge_old_audit_logs(12)');
  end if;
end;
$$;

commit;
