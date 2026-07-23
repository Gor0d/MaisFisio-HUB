-- P0: completa o isolamento de leitura dos catálogos operacionais por unidade.
-- Serviços, indicadores e escalas são globais; unidades, setores e colaboradores
-- são dados operacionais e não podem ser enumerados por usuários de outra unidade.

begin;

drop policy if exists "authenticated reads units" on public.units;
create policy "members read units" on public.units for select to authenticated
using (public.is_member_of(id));

drop policy if exists "authenticated reads service sectors" on public.service_sectors;
create policy "unit members read service sectors" on public.service_sectors for select to authenticated
using (exists (
  select 1
  from public.sectors s
  where s.id = service_sectors.sector_id
    and public.is_member_of(s.unit_id)
));

drop policy if exists "authenticated reads collaborators" on public.collaborators;
create policy "unit and service members read collaborators" on public.collaborators for select to authenticated
using (
  active
  and (
    public.current_app_role() in ('super_admin', 'admin')
    or service_id = public.current_service_id()
  )
  and exists (
    select 1
    from public.collaborator_units cu
    where cu.collaborator_id = collaborators.id
      and public.is_member_of(cu.unit_id)
  )
);

commit;
