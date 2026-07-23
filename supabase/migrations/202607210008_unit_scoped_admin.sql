-- P0: fecha a RLS administrativa por unidade. Antes, um admin (papel restrito
-- à própria unidade na intenção do produto) conseguia ler e alterar perfis,
-- colaboradores, aliases e metas de QUALQUER unidade — bastava o papel
-- 'admin', sem checar profile_units/collaborator_units. Corrige a lacuna
-- preservando acesso global apenas para super_admin.

begin;

-- Dois usuários compartilham alguma unidade (profile_units). Base para
-- restringir admin ao próprio "raio de ação" administrativo.
create or replace function public.shares_unit_with(target_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1 from public.profile_units mine
    join public.profile_units target on target.unit_id = mine.unit_id
    where mine.user_id = auth.uid() and target.user_id = target_user
  );
$$;

revoke all on function public.shares_unit_with(uuid) from public;
grant execute on function public.shares_unit_with(uuid) to authenticated;

-- profiles: leitura e gestão do admin ficam restritas a quem compartilha
-- unidade com ele; admin nunca pode promover alguém a super_admin.
drop policy if exists "users read own profile managers read service" on public.profiles;
drop policy if exists "admin manages profiles" on public.profiles;

create policy "users read own profile managers read scoped" on public.profiles for select to authenticated
using (
  user_id = auth.uid()
  or public.is_super_admin()
  or (public.current_app_role() = 'admin' and public.shares_unit_with(user_id))
  or (public.current_app_role() = 'coordenador' and service_id = public.current_service_id() and public.shares_unit_with(user_id))
);

create policy "admin manages scoped profiles" on public.profiles for all to authenticated
using (
  public.is_super_admin()
  or (public.current_app_role() = 'admin' and public.shares_unit_with(user_id))
)
with check (
  public.is_super_admin()
  or (public.current_app_role() = 'admin' and public.shares_unit_with(user_id) and role <> 'super_admin')
);

-- collaborators: inserir continua liberado ao criar convite (o vínculo de
-- unidade ainda não existe nesse instante); alterar/excluir passam a exigir
-- que o colaborador já esteja vinculado a uma unidade do gestor.
drop policy if exists "managers manage collaborators" on public.collaborators;

create policy "managers manage scoped collaborators" on public.collaborators for all to authenticated
using (
  public.is_super_admin()
  or (public.current_app_role() = 'admin' and exists (
        select 1 from public.collaborator_units cu where cu.collaborator_id = collaborators.id and public.is_member_of(cu.unit_id)
      ))
  or (public.current_app_role() = 'coordenador' and service_id = public.current_service_id() and exists (
        select 1 from public.collaborator_units cu where cu.collaborator_id = collaborators.id and public.is_member_of(cu.unit_id)
      ))
)
with check (
  public.is_super_admin()
  or (public.current_app_role() = 'admin')
  or (public.current_app_role() = 'coordenador' and service_id = public.current_service_id())
);

-- collaborator_aliases: seguem o mesmo raio de ação do colaborador ao qual
-- pertencem, em vez de ficar aberto a qualquer gestor de qualquer unidade.
drop policy if exists "managers read aliases" on public.collaborator_aliases;
drop policy if exists "managers manage aliases" on public.collaborator_aliases;

create policy "managers read scoped aliases" on public.collaborator_aliases for select to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1 from public.collaborator_units cu
    where cu.collaborator_id = collaborator_aliases.collaborator_id and public.is_member_of(cu.unit_id)
  )
);
create policy "managers manage scoped aliases" on public.collaborator_aliases for all to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1 from public.collaborator_units cu
    where cu.collaborator_id = collaborator_aliases.collaborator_id and public.is_member_of(cu.unit_id)
  )
)
with check (
  public.is_super_admin()
  or exists (
    select 1 from public.collaborator_units cu
    where cu.collaborator_id = collaborator_aliases.collaborator_id and public.is_member_of(cu.unit_id)
  )
);

-- indicator_targets: unit_id nulo = meta global, reservada ao super_admin.
-- Admin/coordenador só criam e enxergam metas da própria unidade.
drop policy if exists "authenticated reads targets" on public.indicator_targets;
drop policy if exists "managers manage targets" on public.indicator_targets;

create policy "unit members read targets" on public.indicator_targets for select to authenticated
using (unit_id is null or public.is_member_of(unit_id));

create policy "managers manage scoped targets" on public.indicator_targets for all to authenticated
using (
  public.is_super_admin()
  or (public.is_manager() and unit_id is not null and public.is_member_of(unit_id))
)
with check (
  public.is_super_admin()
  or (public.is_manager() and unit_id is not null and public.is_member_of(unit_id))
);

commit;
