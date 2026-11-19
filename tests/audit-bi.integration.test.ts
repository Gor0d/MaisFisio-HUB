import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRlsTestDatabase, ids, queryAs } from "./helpers/rls-database";

const item = "92000000-0000-4000-8000-000000000001";
const low = "92000000-0000-4000-8000-000000000002";
const high = "92000000-0000-4000-8000-000000000003";

type Bi = {
  kpis: Record<string, number | string | null>;
  mensal: Array<Record<string, unknown>>;
  setores: Array<Record<string, unknown>>;
  itens: Array<Record<string, unknown>>;
  transicoes: Array<{ entrada: number; saida: number; n: number }>;
  colaboradores: Array<Record<string, unknown>>;
};

describe("Auditoria e B.I. das escalas", () => {
  let db: PGlite;
  const admin = ids.users.adminGalileu;

  const saveScale = (record: string, date: string, moment: "entrada" | "saida", option: string) =>
    queryAs(db, "authenticated", admin, "select public.save_scale_assessment($1::jsonb)", [JSON.stringify({
      unit_id: ids.units.galileu,
      scale_type: "barthel",
      initials: "MAS",
      record_number: record,
      assessment_date: date,
      moment,
      sector_id: ids.sectors.galileu,
      collaborator_id: ids.collaborators.galileu,
      answers: [{ item_id: item, option_id: option }],
    })]);

  const bi = async (as: string, unit: string | null) => {
    const res = await queryAs<{ bi: Bi }>(db, "authenticated", as, "select public.scale_bi('barthel', '2026-07-01', '2026-07-31', $1, null) as bi", [unit]);
    return res.rows[0].bi;
  };

  beforeAll(async () => {
    db = await createRlsTestDatabase();
    await queryAs(db, "service_role", null,
      "insert into public.scale_items (id, scale_type, code, name, display_order, max_points) values ($1, 'barthel', 'bi_item', 'BI Item', 1, 30)", [item]);
    await queryAs(db, "service_role", null,
      "insert into public.scale_item_options (id, item_id, label, points, display_order) values ($1, $3, 'Baixo', 10, 1), ($2, $3, 'Alto', 30, 2)", [low, high, item]);
    // A melhora (10 → 30), B piora (30 → 10), C só tem saída (fora da comparação).
    await saveScale("BI-A", "2026-07-01", "entrada", low);
    await saveScale("BI-A", "2026-07-05", "saida", high);
    await saveScale("BI-B", "2026-07-02", "entrada", high);
    await saveScale("BI-B", "2026-07-06", "saida", low);
    await saveScale("BI-C", "2026-07-07", "saida", high);
  });

  afterAll(async () => db?.close());

  it("calcula pares entrada/saída, melhora, ganho e tempo entre avaliações", async () => {
    const r = await bi(admin, ids.units.galileu);
    expect(r.kpis).toMatchObject({ avaliacoes: 5, entradas: 2, saidas: 3, pacientes: 3, pares: 2, melhoraram: 1, pioraram: 1, mantiveram: 0 });
    expect(Number(r.kpis.ganho_medio)).toBe(0);
    expect(Number(r.kpis.permanencia_media)).toBe(4);
    expect(r.mensal).toHaveLength(1);
    expect(r.mensal[0]).toMatchObject({ mes: "2026-07", entradas: 2, saidas: 3, pares: 2, melhoraram: 1 });
    expect(r.setores[0]).toMatchObject({ setor: "RLS UTI Galileu", pares: 2 });
    expect(r.itens[0]).toMatchObject({ item: "BI Item", max: 30 });
    expect(Number(r.itens[0].media_entrada)).toBe(20);
    expect(r.transicoes.reduce((s, t) => s + t.n, 0)).toBe(2);
    expect(r.colaboradores[0]).toMatchObject({ nome: "Colab Galileu RLS", avaliacoes: 5 });
  });

  it("não entrega dados de outra unidade nem visão geral para quem não é matriz", async () => {
    expect((await bi(ids.users.collaboratorTerezinha, ids.units.galileu)).kpis.avaliacoes).toBe(0);
    expect((await bi(admin, null)).kpis.avaliacoes).toBe(0);
    expect((await bi(ids.users.superAdmin, null)).kpis.avaliacoes).toBe(5);
  });

  it("auditoria grava a unidade e filtra por unidade, entidade e perfil", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const search = (as: string, unit: string | null, tables: string[] | null = null) => queryAs<{ table_name: string; unit_id: string; total_count: string; changed_by_name: string | null }>(
      db, "authenticated", as,
      "select * from public.audit_log_search($1, ($2::date - 1), ($2::date + 1), $3::text[], null, null, 'todos', 50, 0)",
      [unit, today, tables]);

    const scales = await search(admin, ids.units.galileu, ["scale_assessments"]);
    expect(scales.rows).toHaveLength(5);
    expect(scales.rows.every((r) => r.unit_id === ids.units.galileu)).toBe(true);
    expect(Number(scales.rows[0].total_count)).toBe(5);
    expect(scales.rows[0].changed_by_name).toBe("Admin Galileu RLS");

    // Só administrador e matriz: coordenador e colaborador não veem; outra unidade também não.
    expect((await search(ids.users.coordinatorPhysio, ids.units.galileu)).rows).toHaveLength(0);
    expect((await search(ids.users.collaboratorGalileu, ids.units.galileu)).rows).toHaveLength(0);
    expect((await search(ids.users.collaboratorTerezinha, ids.units.galileu)).rows).toHaveLength(0);
  });

  it("vínculos de acesso passam a ser auditados com a unidade e o usuário", async () => {
    await queryAs(db, "service_role", null, "insert into public.profile_units (user_id, unit_id) values ($1, $2)", [ids.users.coordinatorPhysio, ids.units.terezinha]);
    const rows = await queryAs<{ action: string; record_id: string; unit_id: string }>(db, "service_role", null,
      "select action, record_id, unit_id from public.audit_logs where table_name = 'profile_units' order by id desc limit 1");
    expect(rows.rows[0]).toEqual({ action: "INSERT", record_id: ids.users.coordinatorPhysio, unit_id: ids.units.terezinha });
  });

  it("qualidade: aponta entrada sem saída e saída sem entrada, só para administrador", async () => {
    type Q = { resumo: Record<string, unknown>; entradas_pendentes: Array<{ id: string; prontuario: string }>; saidas_pendentes: Array<{ id: string; prontuario: string; motivo: string }> };
    const quality = async (as: string) => (await queryAs<{ q: Q }>(db, "authenticated", as, "select public.scale_data_quality('barthel', '2026-07-01', '2026-07-31', $1, null) as q", [ids.units.galileu])).rows[0].q;
    // D: entrada sem saída (antiga, julho/2026).
    await saveScale("BI-D", "2026-07-03", "entrada", low);
    const q = await quality(admin);
    expect(q.resumo).toMatchObject({ entradas: 3, entradas_sem_saida: 1, em_aberto_antiga: 1, saidas: 3, saidas_sem_entrada: 1, motivos: { sem_entrada: 1 } });
    expect(q.entradas_pendentes.map((e) => e.prontuario)).toEqual(["BI-D"]);
    expect(q.saidas_pendentes.map((e) => [e.prontuario, e.motivo])).toEqual([["BI-C", "sem_entrada"]]);
    const coord = await quality(ids.users.coordinatorPhysio);
    expect(coord.resumo.entradas).toBe(0);
  });

  it("administrador corrige com motivo; coordenador não pode; correção fica na auditoria", async () => {
    type Q = { saidas_pendentes: Array<{ id: string }>; resumo: Record<string, number> };
    const exitC = (await queryAs<{ q: Q }>(db, "authenticated", admin, "select public.scale_data_quality('barthel', '2026-07-01', '2026-07-31', $1, null) as q", [ids.units.galileu])).rows[0].q.saidas_pendentes[0].id;
    const correct = (as: string, changes: object, reason: string) => queryAs(db, "authenticated", as, "select public.admin_correct_scale_assessment($1, $2::jsonb, $3)", [exitC, JSON.stringify(changes), reason]);

    await expect(correct(ids.users.coordinatorPhysio, { moment: "entrada" }, "teste de permissão")).rejects.toThrow(/administrador/);
    await expect(correct(admin, { moment: "entrada" }, "x")).rejects.toThrow(/motivo/);

    // A saída órfã de C era, na verdade, a entrada: corrigida, vira entrada sem saída.
    await correct(admin, { moment: "entrada" }, "Lançada como saída por engano");
    const row = await queryAs<{ moment: string; notes: string }>(db, "service_role", null, "select moment, notes from public.scale_assessments where id = $1", [exitC]);
    expect(row.rows[0].moment).toBe("entrada");
    expect(row.rows[0].notes).toMatch(/Correção em .* por Admin Galileu RLS: Lançada como saída por engano/);
    const audit = await queryAs<{ action: string; old_m: string; new_m: string }>(db, "service_role", null,
      "select action, old_data->>'moment' as old_m, new_data->>'moment' as new_m from public.audit_logs where table_name = 'scale_assessments' and record_id = $1 order by id desc limit 1", [exitC]);
    expect(audit.rows[0]).toEqual({ action: "UPDATE", old_m: "saida", new_m: "entrada" });

    await correct(admin, { delete: true }, "Avaliação duplicada");
    const gone = await queryAs(db, "service_role", null, "select 1 from public.scale_assessments where id = $1", [exitC]);
    expect(gone.rows).toHaveLength(0);
  });

  it("log de acessos responde vazio sem o serviço de autenticação", async () => {
    const rows = await queryAs(db, "authenticated", admin, "select * from public.audit_access_log($1, '2026-01-01', '2026-12-31', 10, 0)", [ids.units.galileu]);
    expect(rows.rows).toHaveLength(0);
  });
});
