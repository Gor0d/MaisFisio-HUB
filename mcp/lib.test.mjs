import { test } from "node:test";
import assert from "node:assert/strict";
import { computeValue, describeFormula, missingReason, monthRange, previousMonth, resolveIndicatorCodes, targetStatus } from "./lib.mjs";

const catalog = [
  { id: "1", code: "fono_broncoaspiracoes", kind: "contagem", derived: false, active: true },
  { id: "2", code: "fono_atendimentos", kind: "contagem", derived: false, active: true },
  { id: "3", code: "fisio_taxa_captados", kind: "taxa", derived: true, active: true },
];

test("período do mês, inclusive fevereiro bissexto e virada de ano", () => {
  assert.deepEqual(monthRange("2028-02"), { start: "2028-02-01", end: "2028-02-29" });
  assert.equal(previousMonth("2026-01"), "2025-12");
  assert.throws(() => monthRange("2026-13"));
});

test("resolve códigos e recusa desconhecidos, repetidos e não contáveis", () => {
  assert.deepEqual(resolveIndicatorCodes(["fono_atendimentos"], catalog, "Den").map((i) => i.id), ["2"]);
  assert.throws(() => resolveIndicatorCodes(["xx"], catalog, "Num"), /inexistente/);
  assert.throws(() => resolveIndicatorCodes(["fono_atendimentos", "fono_atendimentos"], catalog, "Num"), /repetidos/);
  assert.throws(() => resolveIndicatorCodes(["fisio_taxa_captados"], catalog, "Num"), /contagem/);
});

test("mesma conta do banco: nulo sem dado ou denominador zero", () => {
  assert.equal(computeValue({ numerator: 3, denominator: 312, hasDenominator: true, multiplier: 100, decimals: 2 }), 0.96);
  assert.equal(computeValue({ numerator: 0, denominator: 0, hasDenominator: true, multiplier: 100, decimals: 2 }), null);
  assert.equal(computeValue({ numerator: 378, denominator: null, hasDenominator: false, multiplier: 1, decimals: 0 }), 378);
  assert.equal(missingReason({ value: null, hasDenominator: true, numeratorRecords: 5, denominatorRecords: 5, denominator: 0 }), "denominador igual a zero");
});

test("meta mínima e máxima", () => {
  assert.equal(targetStatus(1.28, 1, "minimo"), true);
  assert.equal(targetStatus(7.58, 10, "maximo"), true);
  assert.equal(targetStatus(null, 10, "maximo"), null);
});

test("descreve a fórmula", () => {
  const names = new Map([["1", "Bronco"], ["2", "Atend"]]);
  assert.equal(describeFormula({ numerator_ids: ["1"], denominator_ids: ["2"], sector_ids: ["s"], multiplier: 100 }, names), "(Bronco) ÷ (Atend) × 100 — só nos setores filtrados");
});
