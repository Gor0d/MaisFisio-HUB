import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRlsTestDatabase, ids, queryAs } from "./helpers/rls-database";

type Result = {
  quality_indicator_id: string;
  numerator: string | null;
  denominator: string | null;
  value: string | null;
  numerator_records: string;
  denominator_records: string;
};

const indicator = {
  numerator: "91000000-0000-4000-8000-000000000001",
  denominator: "91000000-0000-4000-8000-000000000002",
  rate: "91000000-0000-4000-8000-000000000003",
};
const otherSector = "91000000-0000-4000-8000-000000000010";

describe("Indicadores de qualidade (Interact)", () => {
  let db: PGlite;
  const admin = ids.users.adminGalileu;

  const createQuality = (overrides: Record<string, unknown> = {}) => {
    const row = {
      unit_id: ids.units.galileu,
      name: `Indicador ${Math.random().toString(36).slice(2)}`,
      numerator_ids: [indicator.numerator],
      denominator_ids: [indicator.denominator],
      sector_ids: [],
      multiplier: 100,
      ...overrides,
    };
    return queryAs<{ id: string }>(
      db,
      "authenticated",
      admin,
      `insert into public.quality_indicators (unit_id, name, numerator_ids, denominator_ids, sector_ids, multiplier)
       values ($1, $2, $3::uuid[], $4::uuid[], $5::uuid[], $6) returning id`,
      [row.unit_id, row.name, row.numerator_ids, row.denominator_ids, row.sector_ids, row.multiplier],
    );
  };

  const results = (start: string, end: string, as: string = admin) =>
    queryAs<Result>(db, "authenticated", as, "select * from public.quality_indicator_results($1, $2)", [start, end]);

  const saveProduction = (date: string, values: Record<string, number>, sector: string = ids.sectors.galileu, shift = "MANHÃ") =>
    queryAs(db, "authenticated", admin, "select public.save_production_record($1::jsonb)", [JSON.stringify({
      unit_id: ids.units.galileu,
      service_id: ids.services.physio,
      record_date: date,
      shift,
      sector_id: sector,
      collaborator_id: ids.collaborators.galileu,
      context: "geral",
      values: Object.entries(values).map(([indicator_id, value]) => ({ indicator_id, value })),
    })]);

  beforeAll(async () => {
    db = await createRlsTestDatabase();
    await queryAs(db, "service_role", null,
      `insert into public.indicators (id, service_id, code, name, context, kind) values
        ($1, $4, 'q_numerador', 'Q Numerador', 'geral', 'contagem'),
        ($2, $4, 'q_denominador', 'Q Denominador', 'geral', 'contagem'),
        ($3, $4, 'q_taxa', 'Q Taxa digitada', 'geral', 'taxa')`,
      [indicator.numerator, indicator.denominator, indicator.rate, ids.services.physio]);
    await queryAs(db, "service_role", null,
      "insert into public.sectors (id, unit_id, code, name, context) values ($1, $2, 'rls_enf', 'RLS Enfermaria', 'enfermaria')",
      [otherSector, ids.units.galileu]);
    await queryAs(db, "service_role", null,
      "insert into public.service_sectors (service_id, sector_id) values ($1, $2)",
      [ids.services.physio, otherSector]);
  }, 30_000);

  afterAll(async () => {
    await db?.close();
  });

  it("calcula taxa como soma(numerador) ÷ soma(denominador), não como média das razões", async () => {
    const { rows } = await createQuality();
    await saveProduction("2026-07-10", { [indicator.numerator]: 8, [indicator.denominator]: 10 });
    await saveProduction("2026-07-11", { [indicator.numerator]: 1, [indicator.denominator]: 5 });

    const result = (await results("2026-07-01", "2026-07-31")).rows.find((r) => r.quality_indicator_id === rows[0].id)!;
    expect(Number(result.numerator)).toBe(9);
    expect(Number(result.denominator)).toBe(15);
    expect(Number(result.value)).toBe(60); // média das razões (80% e 20%) daria 50%
    expect(Number(result.numerator_records)).toBe(2);
  });

  it("devolve nulo (não zero) sem lançamentos ou com denominador zero", async () => {
    const { rows } = await createQuality();
    const empty = (await results("2025-01-01", "2025-01-31")).rows.find((r) => r.quality_indicator_id === rows[0].id)!;
    expect(empty.value).toBeNull();
    expect(Number(empty.numerator_records)).toBe(0);

    await saveProduction("2026-08-05", { [indicator.numerator]: 3, [indicator.denominator]: 0 });
    const zeroDen = (await results("2026-08-01", "2026-08-31")).rows.find((r) => r.quality_indicator_id === rows[0].id)!;
    expect(zeroDen.value).toBeNull();
  });

  it("sem denominador o resultado é a soma, e o fator é ignorado", async () => {
    const { rows } = await createQuality({ denominator_ids: [], multiplier: 100 });
    await saveProduction("2026-09-02", { [indicator.numerator]: 4 }, ids.sectors.galileu, "TARDE");
    await saveProduction("2026-09-03", { [indicator.numerator]: 6 }, ids.sectors.galileu, "TARDE");

    const stored = await queryAs<{ multiplier: string }>(db, "authenticated", admin, "select multiplier from public.quality_indicators where id = $1", [rows[0].id]);
    expect(Number(stored.rows[0].multiplier)).toBe(1);
    const result = (await results("2026-09-01", "2026-09-30")).rows.find((r) => r.quality_indicator_id === rows[0].id)!;
    expect(Number(result.value)).toBe(10);
  });

  it("respeita o filtro de setores", async () => {
    const { rows } = await createQuality({ denominator_ids: [], sector_ids: [ids.sectors.galileu] });
    await saveProduction("2026-10-05", { [indicator.numerator]: 7 }, ids.sectors.galileu, "NOITE");
    await saveProduction("2026-10-05", { [indicator.numerator]: 100 }, otherSector, "NOITE");

    const result = (await results("2026-10-01", "2026-10-31")).rows.find((r) => r.quality_indicator_id === rows[0].id)!;
    expect(Number(result.value)).toBe(7);
  });

  it("rejeita fórmula inválida: taxa digitada, setor de outra unidade, repetidos e nome duplicado", async () => {
    await expect(createQuality({ numerator_ids: [indicator.rate] })).rejects.toThrow(/apenas indicadores de contagem/i);
    await expect(createQuality({ denominator_ids: [indicator.rate] })).rejects.toThrow(/apenas indicadores de contagem/i);
    await expect(createQuality({ numerator_ids: [indicator.numerator, indicator.numerator] })).rejects.toThrow(/repetidos/i);
    await expect(createQuality({ sector_ids: [ids.sectors.terezinha] })).rejects.toThrow(/pertencer à unidade/i);
    await expect(createQuality({ name: "Nome único" })).resolves.toBeDefined();
    await expect(createQuality({ name: "  nome único " })).rejects.toThrow(/duplicate key|unique/i);
  });

  it("somente admin da unidade e matriz acessam; coordenador, colaborador e anônimo não", async () => {
    const { rows } = await createQuality();
    const visibleTo = async (userId: string) => (await queryAs<{ id: string }>(
      db, "authenticated", userId, "select id from public.quality_indicators where id = $1", [rows[0].id],
    )).rows.length;

    expect(await visibleTo(admin)).toBe(1);
    expect(await visibleTo(ids.users.superAdmin)).toBe(1);
    expect(await visibleTo(ids.users.coordinatorPhysio)).toBe(0);
    expect(await visibleTo(ids.users.collaboratorGalileu)).toBe(0);
    expect(await visibleTo(ids.users.collaboratorTerezinha)).toBe(0);
    expect((await results("2026-07-01", "2026-07-31", ids.users.coordinatorPhysio)).rows).toEqual([]);

    await expect(queryAs(db, "authenticated", ids.users.coordinatorPhysio,
      "insert into public.quality_indicators (unit_id, name, numerator_ids) values ($1, 'Negado', $2::uuid[])",
      [ids.units.galileu, [indicator.numerator]])).rejects.toThrow(/row-level security/i);
    expect((await queryAs(db, "anon", null, "select id from public.quality_indicators")).rows).toEqual([]);
  });

  it("registra criação na auditoria da unidade", async () => {
    const { rows } = await createQuality();
    const audit = await queryAs<{ action: string }>(db, "service_role", null,
      "select action from public.audit_logs where table_name = 'quality_indicators' and record_id = $1", [rows[0].id]);
    expect(audit.rows).toEqual([{ action: "INSERT" }]);
  });
});
