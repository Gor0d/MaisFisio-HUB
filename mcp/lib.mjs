// Regras puras do MCP (sem rede), testadas em lib.test.mjs.

export function monthRange(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month ?? "")) throw new Error("Mês deve estar no formato AAAA-MM (ex.: 2026-10).");
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
}

export function previousMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Converte códigos do catálogo em ids, apontando os desconhecidos e os que não podem entrar em fórmula. */
export function resolveIndicatorCodes(codes, catalog, label) {
  const unique = [...new Set((codes ?? []).map((c) => String(c).trim()).filter(Boolean))];
  if (unique.length !== (codes ?? []).length) throw new Error(`${label}: há códigos repetidos.`);
  const byCode = new Map(catalog.map((i) => [i.code, i]));
  const missing = unique.filter((c) => !byCode.has(c));
  if (missing.length) throw new Error(`${label}: código(s) inexistente(s): ${missing.join(", ")}. Use listar_indicadores_producao.`);
  const invalid = unique.filter((c) => { const i = byCode.get(c); return i.kind !== "contagem" || i.derived || !i.active; });
  if (invalid.length) throw new Error(`${label}: só indicadores de contagem ativos e não derivados entram em fórmula: ${invalid.join(", ")}.`);
  return unique.map((c) => byCode.get(c));
}

/** Mesma conta do banco (quality_indicator_results): soma(numerador)/soma(denominador) × multiplicador. */
export function computeValue({ numerator, denominator, hasDenominator, multiplier, decimals }) {
  const round = (v) => Number(v.toFixed(decimals));
  if (!hasDenominator) return numerator === null ? null : round(numerator);
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return round((numerator / denominator) * multiplier);
}

export function missingReason({ value, hasDenominator, numeratorRecords, denominatorRecords, denominator }) {
  if (value !== null) return null;
  if (!numeratorRecords) return "sem lançamentos do numerador no período";
  if (hasDenominator && !denominatorRecords) return "sem lançamentos do denominador no período";
  if (hasDenominator && Number(denominator) === 0) return "denominador igual a zero";
  return "sem dados";
}

export function targetStatus(value, target, comparison) {
  if (value === null || target === null || target === undefined || !comparison) return null;
  return comparison === "maximo" ? value <= Number(target) : value >= Number(target);
}

export function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Number(value));
}

export function describeFormula(q, names) {
  const list = (ids) => ids.map((id) => names.get(id) ?? id).join(" + ");
  const base = q.denominator_ids.length ? `(${list(q.numerator_ids)}) ÷ (${list(q.denominator_ids)}) × ${q.multiplier}` : `soma de ${list(q.numerator_ids)}`;
  return q.sector_ids.length ? `${base} — só nos setores filtrados` : base;
}
