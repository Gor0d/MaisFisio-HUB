import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRlsTestDatabase, ids, queryAs } from "./helpers/rls-database";

type IdRow = { id: string };
type UserRow = { user_id: string };
type SectorLinkRow = { sector_id: string };
type CollaboratorLinkRow = { collaborator_id: string };

const sorted = (rows: IdRow[]) => rows.map((row) => row.id).sort();
const sortedUsers = (rows: UserRow[]) => rows.map((row) => row.user_id).sort();

describe("RLS executada em PostgreSQL", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createRlsTestDatabase();
  }, 30_000);

  afterAll(async () => {
    await db?.close();
  });

  it("anônimo não lê tabelas internas", async () => {
    const units = await queryAs<IdRow>(db, "anon", null, "select id from public.units");
    const profiles = await queryAs<UserRow>(db, "anon", null, "select user_id from public.profiles");
    const sectors = await queryAs<IdRow>(db, "anon", null, "select id from public.sectors");

    expect(units.rows).toEqual([]);
    expect(profiles.rows).toEqual([]);
    expect(sectors.rows).toEqual([]);
  });

  it("colaborador enxerga somente a própria unidade e serviço", async () => {
    const userId = ids.users.collaboratorGalileu;
    const units = await queryAs<IdRow>(db, "authenticated", userId, "select id from public.units");
    const sectors = await queryAs<IdRow>(db, "authenticated", userId, "select id from public.sectors");
    const profiles = await queryAs<UserRow>(db, "authenticated", userId, "select user_id from public.profiles");
    const collaborators = await queryAs<IdRow>(db, "authenticated", userId, "select id from public.collaborators");
    const sectorLinks = await queryAs<SectorLinkRow>(
      db,
      "authenticated",
      userId,
      "select sector_id from public.service_sectors",
    );
    const collaboratorLinks = await queryAs<CollaboratorLinkRow>(
      db,
      "authenticated",
      userId,
      "select collaborator_id from public.collaborator_units",
    );

    expect(sorted(units.rows)).toEqual([ids.units.galileu]);
    expect(sorted(sectors.rows)).toEqual([ids.sectors.galileu]);
    expect(sortedUsers(profiles.rows)).toEqual([userId]);
    expect(sorted(collaborators.rows)).toEqual([
      ids.collaborators.coordinatorPhysio,
      ids.collaborators.galileu,
    ].sort());
    expect(sectorLinks.rows.map((row) => row.sector_id)).toEqual([
      ids.sectors.galileu,
      ids.sectors.galileu,
    ]);
    expect(collaboratorLinks.rows.map((row) => row.collaborator_id).sort()).toEqual([
      ids.collaborators.coordinatorPhysio,
      ids.collaborators.coordinatorSpeech,
      ids.collaborators.galileu,
    ].sort());

    await expect(queryAs(
      db,
      "authenticated",
      userId,
      "insert into public.sectors (unit_id, code, name, context) values ($1, 'negado_colab', 'Negado', 'uti')",
      [ids.units.galileu],
    )).rejects.toThrow(/row-level security|permission denied/i);
  });

  it("coordenador fica limitado simultaneamente ao serviço e à unidade", async () => {
    const userId = ids.users.coordinatorPhysio;
    const profiles = await queryAs<UserRow>(db, "authenticated", userId, "select user_id from public.profiles");
    const collaborators = await queryAs<IdRow>(db, "authenticated", userId, "select id from public.collaborators");

    expect(sortedUsers(profiles.rows)).toEqual([
      ids.users.adminGalileu,
      ids.users.collaboratorGalileu,
      ids.users.coordinatorPhysio,
    ].sort());
    expect(sorted(collaborators.rows)).toEqual([
      ids.collaborators.coordinatorPhysio,
      ids.collaborators.galileu,
    ].sort());
    expect(sorted(collaborators.rows)).not.toContain(ids.collaborators.coordinatorSpeech);
    expect(sorted(collaborators.rows)).not.toContain(ids.collaborators.terezinha);
  });

  it("admin fica limitado à unidade e não promove para super_admin", async () => {
    const userId = ids.users.adminGalileu;
    const units = await queryAs<IdRow>(db, "authenticated", userId, "select id from public.units");
    const profiles = await queryAs<UserRow>(db, "authenticated", userId, "select user_id from public.profiles");
    const sectors = await queryAs<IdRow>(db, "authenticated", userId, "select id from public.sectors");

    expect(sorted(units.rows)).toEqual([ids.units.galileu]);
    expect(sorted(sectors.rows)).toEqual([ids.sectors.galileu]);
    expect(sortedUsers(profiles.rows)).toEqual([
      ids.users.adminGalileu,
      ids.users.collaboratorGalileu,
      ids.users.coordinatorPhysio,
      ids.users.coordinatorSpeech,
    ].sort());
    expect(sortedUsers(profiles.rows)).not.toContain(ids.users.collaboratorTerezinha);

    await expect(queryAs(
      db,
      "authenticated",
      userId,
      "update public.profiles set role = 'super_admin' where user_id = $1",
      [ids.users.collaboratorGalileu],
    )).rejects.toThrow(/permission denied|row-level security/i);

    await expect(queryAs(
      db,
      "authenticated",
      userId,
      "insert into public.sectors (unit_id, code, name, context) values ($1, 'negado_admin', 'Negado', 'uti')",
      [ids.units.terezinha],
    )).rejects.toThrow(/row-level security/i);
  });

  it("super_admin mantém a visão consolidada", async () => {
    const userId = ids.users.superAdmin;
    const units = await queryAs<IdRow>(db, "authenticated", userId, "select id from public.units");
    const profiles = await queryAs<UserRow>(db, "authenticated", userId, "select user_id from public.profiles");
    const collaborators = await queryAs<IdRow>(db, "authenticated", userId, "select id from public.collaborators");

    expect(sorted(units.rows)).toEqual(Object.values(ids.units).sort());
    expect(profiles.rows).toHaveLength(Object.keys(ids.users).length);
    expect(collaborators.rows).toHaveLength(Object.keys(ids.collaborators).length);
  });

  it("admin salva setor e serviços de forma atômica somente na própria unidade", async () => {
    const created = await queryAs<{ id: string }>(
      db,
      "authenticated",
      ids.users.adminGalileu,
      `select public.save_sector_with_services(
        null::uuid,
        $1::uuid,
        'RLS Enfermaria Nova',
        'enfermaria',
        array[$2::uuid, $3::uuid]
      ) as id`,
      [ids.units.galileu, ids.services.physio, ids.services.speech],
    );
    const sectorId = created.rows[0].id;

    const links = await queryAs<{ service_id: string }>(
      db,
      "authenticated",
      ids.users.adminGalileu,
      "select service_id from public.service_sectors where sector_id = $1 order by service_id",
      [sectorId],
    );
    expect(links.rows.map((row) => row.service_id)).toEqual([
      ids.services.physio,
      ids.services.speech,
    ].sort());

    await queryAs(
      db,
      "authenticated",
      ids.users.adminGalileu,
      `select public.save_sector_with_services(
        $1::uuid,
        $2::uuid,
        'RLS Enfermaria Editada',
        'clinica',
        array[$3::uuid]
      )`,
      [sectorId, ids.units.galileu, ids.services.physio],
    );
    const editedLinks = await queryAs<{ service_id: string }>(
      db,
      "authenticated",
      ids.users.adminGalileu,
      "select service_id from public.service_sectors where sector_id = $1",
      [sectorId],
    );
    expect(editedLinks.rows).toEqual([{ service_id: ids.services.physio }]);

    await expect(queryAs(
      db,
      "authenticated",
      ids.users.adminGalileu,
      `select public.save_sector_with_services(
        null::uuid,
        $1::uuid,
        'RLS Setor Fora da Unidade',
        'uti',
        array[$2::uuid]
      )`,
      [ids.units.terezinha, ids.services.physio],
    )).rejects.toThrow(/fora do seu escopo/i);

    await expect(queryAs(
      db,
      "authenticated",
      ids.users.collaboratorGalileu,
      `select public.save_sector_with_services(
        null::uuid,
        $1::uuid,
        'RLS Setor por Colaborador',
        'uti',
        array[$2::uuid]
      )`,
      [ids.units.galileu, ids.services.physio],
    )).rejects.toThrow(/apenas administradores/i);
  });

  it("gestão de usuários respeita papel, serviço e unidades em uma transação", async () => {
    const updateAccess = (
      actorId: string,
      targetId: string,
      role: "admin" | "coordenador" | "colaborador",
      serviceId: string,
      active: boolean,
      unitIds: string[],
      collaboratorUnitIds: string[],
    ) => queryAs(
      db,
      "service_role",
      null,
      `select public.admin_update_user_access(
        $1::uuid, $2::uuid, 'Usuário Atualizado RLS', $3::public.app_role,
        $4::uuid, $5::boolean, $6::uuid[], $7::uuid[]
      )`,
      [actorId, targetId, role, serviceId, active, unitIds, collaboratorUnitIds],
    );

    await updateAccess(
      ids.users.coordinatorPhysio,
      ids.users.collaboratorGalileu,
      "colaborador",
      ids.services.physio,
      false,
      [ids.units.galileu],
      [ids.units.galileu],
    );
    const deactivated = await queryAs<{ active: boolean; role: string }>(
      db,
      "service_role",
      null,
      "select active, role::text as role from public.profiles where user_id = $1",
      [ids.users.collaboratorGalileu],
    );
    expect(deactivated.rows).toEqual([{ active: false, role: "colaborador" }]);

    await expect(updateAccess(
      ids.users.coordinatorPhysio,
      ids.users.collaboratorGalileu,
      "coordenador",
      ids.services.physio,
      true,
      [ids.units.galileu],
      [ids.units.galileu],
    )).rejects.toThrow(/só gerencia colaboradores/i);

    await updateAccess(
      ids.users.adminGalileu,
      ids.users.collaboratorGalileu,
      "coordenador",
      ids.services.physio,
      true,
      [ids.units.galileu],
      [ids.units.galileu],
    );
    const promoted = await queryAs<{ active: boolean; role: string }>(
      db,
      "service_role",
      null,
      "select active, role::text as role from public.profiles where user_id = $1",
      [ids.users.collaboratorGalileu],
    );
    expect(promoted.rows).toEqual([{ active: true, role: "coordenador" }]);

    await expect(updateAccess(
      ids.users.adminGalileu,
      ids.users.collaboratorTerezinha,
      "colaborador",
      ids.services.physio,
      true,
      [ids.units.terezinha],
      [ids.units.terezinha],
    )).rejects.toThrow(/fora do escopo do administrador/i);

    await updateAccess(
      ids.users.superAdmin,
      ids.users.collaboratorTerezinha,
      "colaborador",
      ids.services.speech,
      true,
      [ids.units.galileu, ids.units.terezinha],
      [ids.units.terezinha],
    );
    const links = await queryAs<{ unit_id: string }>(
      db,
      "service_role",
      null,
      "select unit_id from public.profile_units where user_id = $1 order by unit_id",
      [ids.users.collaboratorTerezinha],
    );
    expect(links.rows.map((row) => row.unit_id)).toEqual([
      ids.units.galileu,
      ids.units.terezinha,
    ].sort());
  });

  it("provisiona convite de forma atômica, idempotente e recuperável", async () => {
    const invitedUserId = "40000000-0000-4000-8000-000000000101";
    const rejectedUserId = "40000000-0000-4000-8000-000000000102";

    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data) values
        ($1, 'convite.ok@rls.test', '{"full_name":"Convite OK"}'),
        ($2, 'convite.rejeitado@rls.test', '{"full_name":"Convite Rejeitado"}')`,
      [invitedUserId, rejectedUserId],
    );

    const provision = (actorId: string, targetId: string, serviceId: string) => queryAs<{ collaborator_id: string }>(
      db,
      "service_role",
      null,
      `select public.admin_provision_invited_user(
        $1::uuid, $2::uuid, 'Profissional Convidado', 'colaborador',
        $3::uuid, $4::uuid
      ) as collaborator_id`,
      [actorId, targetId, serviceId, ids.units.galileu],
    );

    const first = await provision(ids.users.adminGalileu, invitedUserId, ids.services.physio);
    const retry = await provision(ids.users.adminGalileu, invitedUserId, ids.services.physio);
    expect(retry.rows[0].collaborator_id).toBe(first.rows[0].collaborator_id);

    const state = await queryAs<{ role: string; profile_units: number; collaborators: number; collaborator_units: number }>(
      db,
      "service_role",
      null,
      `select
        p.role::text as role,
        (select count(*)::int from public.profile_units where user_id = p.user_id) as profile_units,
        (select count(*)::int from public.collaborators where user_id = p.user_id) as collaborators,
        (
          select count(*)::int
          from public.collaborator_units cu
          join public.collaborators c on c.id = cu.collaborator_id
          where c.user_id = p.user_id
        ) as collaborator_units
      from public.profiles p
      where p.user_id = $1`,
      [invitedUserId],
    );
    expect(state.rows).toEqual([{
      role: "colaborador",
      profile_units: 1,
      collaborators: 1,
      collaborator_units: 1,
    }]);

    await expect(provision(
      ids.users.coordinatorPhysio,
      rejectedUserId,
      ids.services.speech,
    )).rejects.toThrow(/próprio serviço/i);

    const rolledBack = await queryAs<{ role: string; service_id: string | null; unit_links: number; collaborators: number }>(
      db,
      "service_role",
      null,
      `select
        p.role::text as role,
        p.service_id,
        (select count(*)::int from public.profile_units where user_id = p.user_id) as unit_links,
        (select count(*)::int from public.collaborators where user_id = p.user_id) as collaborators
      from public.profiles p
      where p.user_id = $1`,
      [rejectedUserId],
    );
    expect(rolledBack.rows).toEqual([{
      role: "colaborador",
      service_id: null,
      unit_links: 0,
      collaborators: 0,
    }]);
  });

  it("agrega KPIs com turno e colaborador no mesmo recorte do dashboard", async () => {
    const indicatorId = "60000000-0000-4000-8000-000000000101";
    const afternoonRecordId = "70000000-0000-4000-8000-000000000101";
    const nightRecordId = "70000000-0000-4000-8000-000000000102";

    await queryAs(
      db,
      "service_role",
      null,
      `insert into public.indicators (
        id, service_id, code, name, context, kind
      ) values (
        $1, $2, 'rls_filtro_dashboard', 'RLS Filtro Dashboard', 'geral', 'contagem'
      )`,
      [indicatorId, ids.services.physio],
    );
    await queryAs(
      db,
      "service_role",
      null,
      `insert into public.production_records (
        id, unit_id, service_id, record_date, shift, sector_id,
        collaborator_id, context, created_by
      ) values
        ($1, $2, $3, '2026-07-10', 'TARDE', $4, $5, 'geral', $6),
        ($7, $2, $3, '2026-07-10', 'NOITE', $4, $8, 'geral', $6)`,
      [
        afternoonRecordId,
        ids.units.galileu,
        ids.services.physio,
        ids.sectors.galileu,
        ids.collaborators.galileu,
        ids.users.adminGalileu,
        nightRecordId,
        ids.collaborators.coordinatorPhysio,
      ],
    );
    await queryAs(
      db,
      "service_role",
      null,
      `insert into public.production_values (record_id, indicator_id, numeric_value) values
        ($1, $2, 5),
        ($3, $2, 7)`,
      [afternoonRecordId, indicatorId, nightRecordId],
    );

    const total = async (shift: string | null, collaboratorId: string | null) => {
      const result = await queryAs<{ total: string | number | null }>(
        db,
        "authenticated",
        ids.users.adminGalileu,
        `select total
        from public.production_metrics_totals(
          '2026-07-01'::date, '2026-07-31'::date, $1::uuid, $2::uuid,
          null::uuid, $3::public.work_shift, $4::uuid
        )
        where indicator_id = $5`,
        [ids.units.galileu, ids.services.physio, shift, collaboratorId, indicatorId],
      );
      return result.rows[0].total === null ? null : Number(result.rows[0].total);
    };

    expect(await total(null, null)).toBe(12);
    expect(await total("TARDE", null)).toBe(5);
    expect(await total(null, ids.collaborators.coordinatorPhysio)).toBe(7);
    expect(await total("TARDE", ids.collaborators.coordinatorPhysio)).toBeNull();
  });

  it("filtra a auditoria administrativa pela unidade ativa", async () => {
    await queryAs(
      db,
      "service_role",
      null,
      `insert into public.audit_logs (
        table_name, record_id, action, new_data, changed_by, changed_at
      ) values
        ('production_records', 'auditoria-galileu', 'INSERT', jsonb_build_object('unit_id', $1::text), $3, now() + interval '1 minute'),
        ('production_records', 'auditoria-terezinha', 'INSERT', jsonb_build_object('unit_id', $2::text), $3, now() + interval '2 minutes')`,
      [ids.units.galileu, ids.units.terezinha, ids.users.adminGalileu],
    );

    const audit = await queryAs<{ record_id: string }>(
      db,
      "authenticated",
      ids.users.adminGalileu,
      "select record_id from public.admin_audit_logs($1::uuid, 100)",
      [ids.units.galileu],
    );
    const recordIds = audit.rows.map((row) => row.record_id);
    expect(recordIds).toContain("auditoria-galileu");
    expect(recordIds).not.toContain("auditoria-terezinha");
  });

  it("responder uma escala gera só um evento de auditoria, não um por item", async () => {
    const itemAId = "80000000-0000-4000-8000-000000000001";
    const itemBId = "80000000-0000-4000-8000-000000000002";
    const optionAId = "80000000-0000-4000-8000-000000000011";
    const optionBId = "80000000-0000-4000-8000-000000000012";

    await queryAs(
      db,
      "service_role",
      null,
      `insert into public.scale_items (id, scale_type, code, name, display_order, max_points) values
        ($1, 'melhoria_uti', 'rls_item_a', 'RLS Item A', 1, 10),
        ($2, 'melhoria_uti', 'rls_item_b', 'RLS Item B', 2, 5)`,
      [itemAId, itemBId],
    );
    await queryAs(
      db,
      "service_role",
      null,
      `insert into public.scale_item_options (id, item_id, label, points, display_order) values
        ($1, $3, 'RLS Opção A', 10, 1),
        ($2, $4, 'RLS Opção B', 5, 1)`,
      [optionAId, optionBId, itemAId, itemBId],
    );

    const saved = await queryAs<{ id: string }>(
      db,
      "authenticated",
      ids.users.adminGalileu,
      `select public.save_scale_assessment(jsonb_build_object(
        'unit_id', $1::text,
        'scale_type', 'melhoria_uti',
        'initials', 'MAS',
        'record_number', 'RLS-AUDIT-001',
        'assessment_date', '2026-07-10',
        'moment', 'entrada',
        'sector_id', $2::text,
        'answers', jsonb_build_array(
          jsonb_build_object('item_id', $3::text, 'option_id', $4::text),
          jsonb_build_object('item_id', $5::text, 'option_id', $6::text)
        )
      )) as id`,
      [ids.units.galileu, ids.sectors.galileu, itemAId, optionAId, itemBId, optionBId],
    );
    const assessmentId = saved.rows[0].id;

    const totals = await queryAs<{ total: number; complete: boolean }>(
      db,
      "service_role",
      null,
      "select total, complete from public.scale_assessments where id = $1",
      [assessmentId],
    );
    expect(totals.rows).toEqual([{ total: 15, complete: true }]);

    const audit = await queryAs<{ action: string }>(
      db,
      "service_role",
      null,
      "select action from public.audit_logs where table_name = 'scale_assessments' and record_id = $1",
      [assessmentId],
    );
    expect(audit.rows).toEqual([{ action: "INSERT" }]);
  });
});
