import { describe, expect, it } from "vitest";
import { buildMonthlyReport, formatDelta, formatTarget, formatValue, previousMonth } from "@/lib/report-model";

const catalog = [
  { id: "a", display_order: 2, context: "geral", service_code: "fisioterapia", service_name: "Fisioterapia" },
  { id: "b", display_order: 1, context: "uti", service_code: "fisioterapia", service_name: "Fisioterapia" },
  { id: "c", display_order: 1, context: "geral", service_code: "psicologia", service_name: "Psicologia" },
  { id: "t", display_order: 3, context: "geral", service_code: "terapia_ocupacional", service_name: "Terapia Ocupacional" },
];
const total = (indicator_id: string, code: string, kind: string, value: number | null) => ({ indicator_id, indicator_code: code, indicator_name: code, kind, derived: false, total: value });

describe("relatório mensal", () => {
  const report = buildMonthlyReport({
    month: "2026-01",
    unitName: "Hospital",
    activeUnitId: "u1",
    totals: [total("c", "psi_atendimentos", "contagem", 50), total("a", "fisio_altas", "contagem", 120), total("b", "fisio_taxa", "taxa", 80), total("t", "to_texto", "texto", 1)],
    previousTotals: [total("a", "fisio_altas", "contagem", 100), total("b", "fisio_taxa", "taxa", 75.5), total("c", "psi_atendimentos", "contagem", 0)],
    catalog,
    targets: [{ indicator_id: "b", unit_id: null, sector_id: null, target_value: 85, comparison: "minimo", valid_from: "2025-01-01", valid_until: null }],
    scales: [
      { scale_type: "barthel", moment: "saida", total: 80, improved: true },
      { scale_type: "barthel", moment: "saida", total: 40, improved: false },
      { scale_type: "barthel", moment: "entrada", total: 20, improved: null },
    ],
    generatedAt: new Date("2026-02-01T12:00:00Z"),
  });

  it("agrupa por serviço na ordem institucional e por display_order", () => {
    expect(report.services.map((s) => s.code)).toEqual(["fisioterapia", "psicologia"]);
    expect(report.services[0].rows.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("ignora indicadores de texto", () => {
    expect(report.summary.indicators).toBe(3);
  });

  it("variação relativa para contagem e em p.p. para taxa; sem base zero", () => {
    const [taxa, altas] = report.services[0].rows;
    expect(formatDelta(altas)).toBe("+20,00%");
    expect(formatDelta(taxa)).toBe("+4,50 p.p.");
    expect(formatDelta(report.services[1].rows[0])).toBe("—");
  });

  it("avalia metas e conta atingidas", () => {
    const taxa = report.services[0].rows[0];
    expect(taxa.achieved).toBe(false);
    expect(formatTarget(taxa)).toBe("mín. 85,00%");
    expect(report.summary).toMatchObject({ targetsTotal: 1, targetsAchieved: 0 });
  });

  it("calcula melhora só nas saídas avaliadas", () => {
    expect(report.scales[0]).toMatchObject({ assessments: 3, exits: 2, improved: 1, rate: 50 });
    expect(report.summary.improvementRate).toBe(50);
  });

  it("formata e vira o ano no mês anterior", () => {
    expect(formatValue({ kind: "contagem" }, 1234.5)).toBe("1.234,5");
    expect(formatValue({ kind: "taxa" }, null)).toBe("—");
    expect(previousMonth("2026-01")).toBe("2025-12");
    expect(report.previousMonthLabel).toBe("dezembro de 2025");
  });
});
