import { describe, expect, it } from "vitest";
import { barthelClassification, calculateScaleTotal, hasFunctionalImprovement } from "@/lib/scales";
import { scaleAssessmentSchema } from "@/lib/validation";
import { parseDate, parseNumber } from "@/scripts/import-xlsx";

describe("regras das escalas", () => {
  it("calcula os limites máximos definidos", () => {
    expect(calculateScaleTotal([10, 5, 5, 10, 10, 10, 10, 15, 15, 10])).toBe(100);
    expect(calculateScaleTotal(Array(12).fill(5))).toBe(60);
    expect(calculateScaleTotal([15, 5, 3, 10])).toBe(33);
  });

  it("só considera melhora quando saída é maior", () => {
    expect(hasFunctionalImprovement(40, 55)).toBe(true);
    expect(hasFunctionalImprovement(55, 55)).toBe(false);
    expect(hasFunctionalImprovement(55, 40)).toBe(false);
    expect(hasFunctionalImprovement(null, 40)).toBeNull();
  });

  it("classifica Barthel nos intervalos documentados", () => {
    expect(barthelClassification(20)).toBe("Dependência total");
    expect(barthelClassification(61)).toBe("Dependência moderada");
    expect(barthelClassification(100)).toBe("Independente");
  });
});

describe("proteção LGPD", () => {
  it("recusa iniciais com caracteres incompatíveis", () => {
    const result = scaleAssessmentSchema.safeParse({ scale_type: "barthel", initials: "Paciente 123", record_number: "1", assessment_date: "2026-07-16", moment: "entrada", sector_id: "123e4567-e89b-12d3-a456-426614174000", answers: [{ item_id: "123e4567-e89b-12d3-a456-426614174000", option_id: "123e4567-e89b-12d3-a456-426614174001" }] });
    expect(result.success).toBe(false);
  });
});

describe("limpeza da planilha", () => {
  it("corrige os anos anômalos conhecidos", () => {
    expect(parseDate("21/03/0202")).toEqual({ date: "2022-03-21", corrected: "0202→2022" });
    expect(parseDate("09/03/0204").date).toBe("2024-03-09");
    expect(parseDate("23/08/0224").date).toBe("2024-08-23");
  });

  it("trata traços, erros e decimais brasileiros", () => {
    expect(parseNumber("-")).toBeNull();
    expect(parseNumber("#DIV/0!")).toBeNull();
    expect(parseNumber("12,5")).toBe(12.5);
  });
});
