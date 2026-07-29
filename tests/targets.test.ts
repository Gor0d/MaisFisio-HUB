import { describe, expect, it } from "vitest";
import { effectiveTarget, targetSituation, type IndicatorTarget } from "@/lib/targets";

const targets: IndicatorTarget[] = [
  {
    indicator_id: "indicador",
    unit_id: null,
    sector_id: null,
    target_value: 80,
    comparison: "minimo",
    valid_from: "2026-01-01",
  },
  {
    indicator_id: "indicador",
    unit_id: "galileu",
    sector_id: null,
    target_value: 90,
    comparison: "minimo",
    valid_from: "2026-02-01",
  },
  {
    indicator_id: "indicador",
    unit_id: "galileu",
    sector_id: "uti",
    target_value: 5,
    comparison: "maximo",
    valid_from: "2026-03-01",
  },
];

describe("situação de metas", () => {
  it("prioriza setor, unidade e vigência mais específicos", () => {
    expect(effectiveTarget(targets, "indicador", "galileu", "uti")?.target_value).toBe(5);
    expect(effectiveTarget(targets, "indicador", "galileu", null)?.target_value).toBe(90);
    expect(effectiveTarget(targets, "indicador", null, null)?.target_value).toBe(80);
  });

  it("avalia corretamente metas mínimas e máximas", () => {
    expect(targetSituation(91, targets[1])?.achieved).toBe(true);
    expect(targetSituation(89, targets[1])?.achieved).toBe(false);
    expect(targetSituation(5, targets[2])?.achieved).toBe(true);
    expect(targetSituation(6, targets[2])?.achieved).toBe(false);
  });
});
