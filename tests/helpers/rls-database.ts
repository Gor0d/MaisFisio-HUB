import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

export const ids = {
  services: {
    physio: "10000000-0000-4000-8000-000000000001",
    speech: "10000000-0000-4000-8000-000000000002",
  },
  units: {
    galileu: "20000000-0000-4000-8000-000000000001",
    terezinha: "20000000-0000-4000-8000-000000000002",
  },
  sectors: {
    galileu: "30000000-0000-4000-8000-000000000001",
    terezinha: "30000000-0000-4000-8000-000000000002",
  },
  users: {
    superAdmin: "40000000-0000-4000-8000-000000000001",
    adminGalileu: "40000000-0000-4000-8000-000000000002",
    coordinatorPhysio: "40000000-0000-4000-8000-000000000003",
    coordinatorSpeech: "40000000-0000-4000-8000-000000000004",
    collaboratorGalileu: "40000000-0000-4000-8000-000000000005",
    collaboratorTerezinha: "40000000-0000-4000-8000-000000000006",
  },
  collaborators: {
    coordinatorPhysio: "50000000-0000-4000-8000-000000000001",
    coordinatorSpeech: "50000000-0000-4000-8000-000000000002",
    galileu: "50000000-0000-4000-8000-000000000003",
    terezinha: "50000000-0000-4000-8000-000000000004",
  },
} as const;

type DatabaseRole = "anon" | "authenticated";

const bootstrapSql = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );

  create function auth.uid()
  returns uuid
  language sql stable
  as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  alter default privileges in schema public
    grant select, insert, update, delete on tables to anon, authenticated, service_role;
  alter default privileges in schema public
    grant usage, select on sequences to anon, authenticated, service_role;
`;

const seedSql = `
  insert into public.services (id, code, name) values
    ('${ids.services.physio}', 'rls_fisioterapia', 'RLS Fisioterapia'),
    ('${ids.services.speech}', 'rls_fonoaudiologia', 'RLS Fonoaudiologia');

  insert into public.units (id, code, name) values
    ('${ids.units.galileu}', 'rls_galileu', 'RLS Hospital Galileu'),
    ('${ids.units.terezinha}', 'rls_terezinha', 'RLS Santa Terezinha');

  insert into auth.users (id, email, raw_user_meta_data) values
    ('${ids.users.superAdmin}', 'superadmin@rls.test', '{"full_name":"Super Admin RLS"}'),
    ('${ids.users.adminGalileu}', 'admin.galileu@rls.test', '{"full_name":"Admin Galileu RLS"}'),
    ('${ids.users.coordinatorPhysio}', 'coord.fisio@rls.test', '{"full_name":"Coord Fisio RLS"}'),
    ('${ids.users.coordinatorSpeech}', 'coord.fono@rls.test', '{"full_name":"Coord Fono RLS"}'),
    ('${ids.users.collaboratorGalileu}', 'colab.galileu@rls.test', '{"full_name":"Colab Galileu RLS"}'),
    ('${ids.users.collaboratorTerezinha}', 'colab.terezinha@rls.test', '{"full_name":"Colab Terezinha RLS"}');

  update public.profiles set role = 'super_admin', service_id = null
    where user_id = '${ids.users.superAdmin}';
  update public.profiles set role = 'admin', service_id = '${ids.services.physio}'
    where user_id = '${ids.users.adminGalileu}';
  update public.profiles set role = 'coordenador', service_id = '${ids.services.physio}'
    where user_id = '${ids.users.coordinatorPhysio}';
  update public.profiles set role = 'coordenador', service_id = '${ids.services.speech}'
    where user_id = '${ids.users.coordinatorSpeech}';
  update public.profiles set role = 'colaborador', service_id = '${ids.services.physio}'
    where user_id = '${ids.users.collaboratorGalileu}';
  update public.profiles set role = 'colaborador', service_id = '${ids.services.physio}'
    where user_id = '${ids.users.collaboratorTerezinha}';

  insert into public.profile_units (user_id, unit_id) values
    ('${ids.users.adminGalileu}', '${ids.units.galileu}'),
    ('${ids.users.coordinatorPhysio}', '${ids.units.galileu}'),
    ('${ids.users.coordinatorSpeech}', '${ids.units.galileu}'),
    ('${ids.users.collaboratorGalileu}', '${ids.units.galileu}'),
    ('${ids.users.collaboratorTerezinha}', '${ids.units.terezinha}');

  insert into public.sectors (id, unit_id, code, name, context) values
    ('${ids.sectors.galileu}', '${ids.units.galileu}', 'rls_uti', 'RLS UTI Galileu', 'uti'),
    ('${ids.sectors.terezinha}', '${ids.units.terezinha}', 'rls_uti', 'RLS UTI Terezinha', 'uti');

  insert into public.service_sectors (service_id, sector_id) values
    ('${ids.services.physio}', '${ids.sectors.galileu}'),
    ('${ids.services.speech}', '${ids.sectors.galileu}'),
    ('${ids.services.physio}', '${ids.sectors.terezinha}');

  insert into public.collaborators (id, canonical_name, service_id, user_id) values
    ('${ids.collaborators.coordinatorPhysio}', 'Coord Fisio RLS', '${ids.services.physio}', '${ids.users.coordinatorPhysio}'),
    ('${ids.collaborators.coordinatorSpeech}', 'Coord Fono RLS', '${ids.services.speech}', '${ids.users.coordinatorSpeech}'),
    ('${ids.collaborators.galileu}', 'Colab Galileu RLS', '${ids.services.physio}', '${ids.users.collaboratorGalileu}'),
    ('${ids.collaborators.terezinha}', 'Colab Terezinha RLS', '${ids.services.physio}', '${ids.users.collaboratorTerezinha}');

  insert into public.collaborator_units (collaborator_id, unit_id) values
    ('${ids.collaborators.coordinatorPhysio}', '${ids.units.galileu}'),
    ('${ids.collaborators.coordinatorSpeech}', '${ids.units.galileu}'),
    ('${ids.collaborators.galileu}', '${ids.units.galileu}'),
    ('${ids.collaborators.terezinha}', '${ids.units.terezinha}');
`;

export async function createRlsTestDatabase() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(bootstrapSql);

  const migrationsDirectory = path.resolve("supabase/migrations");
  const migrations = readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const migration of migrations) {
    await db.exec(readFileSync(path.join(migrationsDirectory, migration), "utf8"));
  }

  await db.exec(seedSql);
  return db;
}

export async function queryAs<T extends Record<string, unknown>>(
  db: PGlite,
  role: DatabaseRole,
  userId: string | null,
  sql: string,
  params: unknown[] = [],
) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  await db.exec(`set role ${role}`);

  try {
    const result = await db.query<T>(sql, params);
    return result;
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}
