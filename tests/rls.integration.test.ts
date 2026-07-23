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
});
