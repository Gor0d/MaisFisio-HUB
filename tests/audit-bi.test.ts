import { describe, expect, it } from "vitest";
import { auditChanges, auditOrigin, collectAuditIds, describeAuditRecord, formatAuditValue } from "@/lib/audit";
import { bandDistribution, bandIndex, bandTransitions, monthShort, rate } from "@/lib/scale-bi";

const sector = "30000000-0000-4000-8000-000000000001";
const names = { [sector]: "Enfermaria Azul" };

describe("auditoria legível", () => {
  it("na alteração mostra só o que mudou, ignorando campos técnicos", () => {
    const changes = auditChanges({
      action: "UPDATE",
      old_data: { id: "x", sector_id: sector, notes: null, total: 10, updated_at: "a", moment: "entrada" },
      new_data: { id: "x", sector_id: sector, notes: "Revisado", total: 12, updated_at: "b", moment: "saida" },
    }, names);
    expect(changes).toEqual([
      { field: "notes", label: "Observações", before: "—", after: "Revisado" },
      { field: "moment", label: "Momento", before: "Entrada", after: "Saída" },
    ]);
  });

  it("na criação e exclusão lista os valores preenchidos", () => {
    expect(auditChanges({ action: "INSERT", old_data: null, new_data: { sector_id: sector, notes: null, active: true } }, names))
      .toEqual([
        { field: "sector_id", label: "Setor", before: "—", after: "Enfermaria Azul" },
        { field: "active", label: "Ativo", before: "—", after: "Sim" },
      ]);
    expect(auditChanges({ action: "DELETE", old_data: { role: "admin" }, new_data: null })[0]).toMatchObject({ before: "Administrador", after: "—" });
  });

  it("formata datas, ids desconhecidos e listas", () => {
    expect(formatAuditValue("record_date", "2026-10-12")).toBe("12/10/2026");
    expect(formatAuditValue("collaborator_id", "abcdef12-0000-4000-8000-000000000000")).toBe("abcdef12…");
    expect(formatAuditValue("sector_ids", [sector], names)).toBe("Enfermaria Azul");
    expect(formatAuditValue("sector_ids", [])).toBe("—");
  });

  it("descreve o registro e a origem", () => {
    expect(describeAuditRecord({ table_name: "scale_assessments", record_id: "1", old_data: null, new_data: { scale_type: "barthel", moment: "saida", assessment_date: "2026-10-01", sector_id: sector } }, names))
      .toBe("Barthel · Saída · 01/10/2026 · Enfermaria Azul");
    expect(auditOrigin({ changed_by: null, changed_by_name: null })).toBe("Sistema (importação)");
    expect(auditOrigin({ changed_by: "u", changed_by_name: "Ana" })).toBe("Ana");
  });

  it("coleta ids citados sem repetir", () => {
    expect(collectAuditIds([{ old_data: { patient_id: "p1" }, new_data: { patient_id: "p1" } }, { old_data: null, new_data: { patient_id: "p2" } }], ["patient_id"]))
      .toEqual(["p1", "p2"]);
  });
});

describe("B.I. das escalas", () => {
  it("classifica nas faixas clínicas", () => {
    expect(bandIndex("barthel", 0)).toBe(0);
    expect(bandIndex("barthel", 60)).toBe(1);
    expect(bandIndex("barthel", 95)).toBe(3);
    expect(bandIndex("barthel", 100)).toBe(4);
    expect(bandIndex("mrc", 47)).toBe(1);
    expect(bandIndex("mrc", 48)).toBe(2);
    expect(bandIndex("melhoria_uti", 33)).toBe(2);
  });

  it("distribui entrada e saída por faixa em percentual", () => {
    const d = bandDistribution("mrc", [
      { momento: "entrada", total: 30, n: 3 }, { momento: "entrada", total: 50, n: 1 },
      { momento: "saida", total: 50, n: 2 },
    ]);
    expect(d.map((x) => [x.entrada, x.saida])).toEqual([[3, 0], [0, 0], [1, 2]]);
    expect(d[0].entradaPct).toBe(75);
    expect(d[2].saidaPct).toBe(100);
  });

  it("conta quem subiu, manteve ou desceu de faixa", () => {
    const t = bandTransitions("mrc", [
      { entrada: 30, saida: 50, n: 4 }, // grave → sem fraqueza
      { entrada: 40, saida: 45, n: 2 }, // mesma faixa
      { entrada: 50, saida: 30, n: 1 }, // desceu
    ]);
    expect([t.up, t.same, t.down, t.total]).toEqual([4, 2, 1, 7]);
    expect(t.matrix[0][2]).toBe(4);
  });

  it("taxa e rótulo do mês", () => {
    expect(rate(1, 3)).toBe(33.3);
    expect(rate(1, 0)).toBeNull();
    expect(monthShort("2026-10")).toBe("Out/26");
  });
});
