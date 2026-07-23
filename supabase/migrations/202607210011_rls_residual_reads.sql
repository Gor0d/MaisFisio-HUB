-- P0 (achado do Codex, registrado em docs/handoff-agentes.md 22/07): três
-- políticas de LEITURA ainda eram globais para qualquer autenticado, driblando
-- o isolamento por unidade que a migração 202607210008 fechou para escrita:
--   - sectors: qualquer colaborador lia os setores de TODAS as unidades.
--   - collaborator_units: qualquer colaborador via a equipe de TODAS as
--     unidades (quem trabalha em qual unidade).
--   - profile_units: qualquer gestor (admin/coordenador) de QUALQUER unidade
--     lia os vínculos de usuário↔unidade de todas as unidades.
-- A interface já filtrava visualmente, mas a API/anon key expunha tudo.

begin;

drop policy if exists "authenticated reads sectors" on public.sectors;
create policy "unit members read sectors" on public.sectors for select to authenticated
using (public.is_member_of(unit_id));

drop policy if exists "authenticated reads collaborator units" on public.collaborator_units;
create policy "unit members read collaborator units" on public.collaborator_units for select to authenticated
using (public.is_member_of(unit_id));

drop policy if exists "users read own unit links managers read all" on public.profile_units;
create policy "users read own unit links managers read scoped" on public.profile_units for select to authenticated
using (user_id = auth.uid() or public.is_super_admin() or (public.is_manager() and public.is_member_of(unit_id)));

commit;
