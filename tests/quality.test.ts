import { describe, expect, it } from "vitest";
import {
  buildPortalRows, describeFormula, formatForPortal, formatQualityValue, missingReason,
  monthRange, occurrenceLabel, periodLabel, previousMonth, previousOf, targetStatus,
  type QualityIndicator, type QualityResult,
} from "@/lib/quality";

const indicator: QualityIndicator = {
  id: "q1", unit_id: "u1", service_id: null, name: "PSI - Taxa de Elegibilidade", interact_code: "PSI-02",
  numerator_ids: ["a"], denominator_ids: ["b"], sector_ids: [], multiplier: 100, result_unit: "%", decimals: 2,
  target_value: 80, target_comparison: "minimo", notes: null, active: true,
};
const result = (over: Partial<QualityResult> = {}): QualityResult => ({
  quality_indicator_id: "q1", numerator: "9.0000", denominator: "15.0000", value: "60.00",
  numerator_records: 2, denominator_records: 2, ...over,
});

describe("período", () => {
  it("calcula início e fim do mês, inclusive fevereiro bissexto", () => {
    expect(monthRange("2026-10")).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(monthRange("2026-02").end).toBe("2026-02-28");
    expect(monthRange("2028-02").end).toBe("2028-02-29");
  });

  it("mês anterior atravessa a virada do ano", () => {
    expect(previousMonth(new Date("2026-11-07T12:00:00Z"))).toBe("2026-10");
    expect(previousMonth(new Date("2027-01-15T12:00:00Z"))).toBe("2026-12");
    expect(previousOf("2027-01")).toBe("2026-12");
  });

  it("rótulos no formato do portal", () => {
    expect(occurrenceLabel("2026-10")).toBe("outubro / 2026");
    expect(periodLabel("2026-10")).toBe("01/10/2026 a 31/10/2026");
  });
});

describe("formatação", () => {
  it("usa vírgula decimal e não usa separador de milhar para o portal", () => {
    expect(formatForPortal("1234.5", 2)).toBe("1234,50");
    expect(formatForPortal(60, 0)).toBe("60");
    expect(formatForPortal(null, 2)).toBe("");
  });

  it("exibe unidade e traço quando não há valor", () => {
    expect(formatQualityValue("60", 2, "%")).toBe("60,00 %");
    expect(formatQualityValue(null, 2, "%")).toBe("—");
    expect(formatQualityValue(10, 0, "un.")).toBe("10");
  });
});

describe("situação e motivos", () => {
  it("compara com a meta mínima e máxima", () => {
    expect(targetStatus(60, indicator)).toBe(false);
    expect(targetStatus(85, indicator)).toBe(true);
    expect(targetStatus(3, { target_value: 5, target_comparison: "maximo" })).toBe(true);
    expect(targetStatus(null, indicator)).toBeNull();
    expect(targetStatus(10, { target_value: null, target_comparison: null })).toBeNull();
  });

  it("explica por que falta o resultado", () => {
    expect(missingReason(indicator, result())).toBeNull();
    expect(missingReason(indicator, result({ value: null, numerator_records: 0 }))).toMatch(/numerador/);
    expect(missingReason(indicator, result({ value: null, denominator_records: 0 }))).toMatch(/denominador no período/);
    expect(missingReason(indicator, result({ value: null, denominator: "0" }))).toMatch(/zerado/);
    expect(missingReason(indicator, undefined)).toMatch(/Sem cálculo/);
  });
});

describe("fórmula e exportação", () => {
  const names = new Map([["a", "Critério de Elegibilidade"], ["b", "Admissões"], ["c", "Evasões"]]);
  const sectors = new Map([["s1", "UTI"]]);

  it("descreve soma, razão com fator e filtro de setor", () => {
    expect(describeFormula({ ...indicator, denominator_ids: [], multiplier: 1 }, names, sectors)).toBe("Soma de Critério de Elegibilidade");
    expect(describeFormula(indicator, names, sectors)).toBe("Critério de Elegibilidade ÷ Admissões × 100");
    expect(describeFormula({ ...indicator, numerator_ids: ["a", "c"], sector_ids: ["s1"] }, names, sectors))
      .toBe("(Critério de Elegibilidade + Evasões) ÷ Admissões × 100 — somente em: UTI");
  });

  it("monta as linhas para o portal com resultado, meta e observação", () => {
    const rows = buildPortalRows([
      { indicator, result: result({ value: "85.00", numerator: "17", denominator: "20" }), unitName: "Galileu" },
      { indicator: { ...indicator, id: "q2", name: "Sem dados", interact_code: null }, result: result({ value: null, numerator_records: 0, numerator: null, denominator: null }), unitName: "Galileu" },
    ], "2026-10");

    expect(rows[0]).toMatchObject({ "Código no Interact": "PSI-02", Ocorrência: "outubro / 2026", Resultado: "85,00", Meta: "mín. 80,00", "Situação da meta": "Atingida", Numerador: 17, Denominador: 20, Observação: "" });
    expect(rows[1]).toMatchObject({ Resultado: "", Numerador: "", "Situação da meta": "", Observação: "Sem lançamentos do numerador no período" });
  });
});
