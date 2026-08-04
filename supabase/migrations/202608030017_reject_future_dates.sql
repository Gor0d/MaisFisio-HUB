begin;

-- "Data futura rejeitada" era, até aqui, só uma restrição do datepicker no
-- cliente (DateField maxIso={todayISO()}) — quem chamasse save_production_record
-- ou save_scale_assessment diretamente (API, script) conseguia gravar uma data
-- futura sem nenhum bloqueio do banco. Formalizando como garantia real de
-- servidor, não só de UI. Confirmado antes de aplicar: nenhuma linha existente
-- viola a regra (0 em produção, 03/08/2026).
alter table public.production_records
  add constraint production_records_no_future_date check (record_date <= current_date);

alter table public.scale_assessments
  add constraint scale_assessments_no_future_date check (assessment_date <= current_date);

commit;
