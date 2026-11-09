// Indicadores de qualidade (Interact): helpers puros de período, formatação,
// situação da meta e linhas de exportação. O cálculo em si fica no banco
// (função quality_indicator_results); aqui só se apresenta o resultado.

export type QualityIndicator = {
  id: string;
  unit_id: string;
  service_id: string | null;
  name: string;
  interact_code: string | null;
  numerator_ids: string[];
  denominator_ids: string[];
  sector_ids: string[];
  multiplier: number | string;
  result_unit: string;
  decimals: number;
  target_value: number | string | null;
  target_comparison: "minimo" | "maximo" | null;
  notes: string | null;
  active: boolean;
};

export type QualityResult = {
  quality_indicator_id: string;
  numerator: number | string | null;
  denominator: number | string | null;
  value: number | string | null;
  numerator_records: number | string;
  denominator_records: number | string;
};

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Mês anterior ao de `today` no formato AAAA-MM (competência que costuma ser fechada). */
export function previousMonth(today: Date = new Date()) {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth(); // 0-11, mês corrente
  return month === 0 ? `${year - 1}-12` : `${year}-${String(month).padStart(2, "0")}`;
}

export function isValidMonth(value: string | undefined | null): value is string {
  return Boolean(value && monthPattern.test(value));
}

/** Primeiro e último dia do mês, sem depender de fuso horário. */
export function monthRange(month: string) {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, "0")}` };
}

export function previousOf(month: string) {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  return monthNumber === 1 ? `${year - 1}-12` : `${year}-${String(monthNumber - 1).padStart(2, "0")}`;
}

const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-10" → "outubro / 2026", como aparece na ocorrência do portal. */
export function occurrenceLabel(month: string) {
  return `${monthNames[Number(month.slice(5, 7)) - 1]} / ${month.slice(0, 4)}`;
}

/** "2026-10" → "01/10/2026 a 31/10/2026". */
export function periodLabel(month: string) {
  const { start, end } = monthRange(month);
  const format = (iso: string) => iso.split("-").reverse().join("/");
  return `${format(start)} a ${format(end)}`;
}

const toNumber = (value: number | string | null | undefined) =>
  value === null || value === undefined || value === "" ? null : Number(value);

/** Número no padrão brasileiro, sem separador de milhar — pronto para digitar no portal. */
export function formatForPortal(value: number | string | null | undefined, decimals: number) {
  const number = toNumber(value);
  if (number === null || !Number.isFinite(number)) return "";
  return number.toFixed(decimals).replace(".", ",");
}

export function formatQualityValue(value: number | string | null | undefined, decimals: number, unit: string) {
  const number = toNumber(value);
  if (number === null || !Number.isFinite(number)) return "—";
  const text = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(number);
  return unit === "un." || unit === "" ? text : `${text} ${unit}`;
}

/** Explica por que não há resultado, para a equipe saber o que lançar. */
export function missingReason(indicator: Pick<QualityIndicator, "denominator_ids">, result: QualityResult | undefined) {
  if (!result) return "Sem cálculo para o período";
  if (toNumber(result.value) !== null) return null;
  if (Number(result.numerator_records) === 0) return "Sem lançamentos do numerador no período";
  if (indicator.denominator_ids.length > 0 && Number(result.denominator_records) === 0) return "Sem lançamentos do denominador no período";
  if (indicator.denominator_ids.length > 0 && !(Number(result.denominator) > 0)) return "Denominador zerado no período";
  return "Sem resultado no período";
}

export function targetStatus(value: number | string | null, indicator: Pick<QualityIndicator, "target_value" | "target_comparison">) {
  const number = toNumber(value);
  const target = toNumber(indicator.target_value);
  if (number === null || target === null || !indicator.target_comparison) return null;
  return indicator.target_comparison === "maximo" ? number <= target : number >= target;
}

/** Texto da fórmula: "(A + B) ÷ (C) × 100 — setores: UTI". */
export function describeFormula(
  indicator: Pick<QualityIndicator, "numerator_ids" | "denominator_ids" | "sector_ids" | "multiplier" | "result_unit">,
  indicatorNames: Map<string, string>,
  sectorNames: Map<string, string>,
) {
  const side = (ids: string[]) => {
    const names = ids.map((id) => indicatorNames.get(id) ?? "indicador removido");
    return names.length > 1 ? `(${names.join(" + ")})` : names[0] ?? "";
  };
  const factor = Number(indicator.multiplier);
  let text = indicator.denominator_ids.length === 0
    ? `Soma de ${side(indicator.numerator_ids)}`
    : `${side(indicator.numerator_ids)} ÷ ${side(indicator.denominator_ids)}${factor !== 1 ? ` × ${factor}` : ""}`;
  if (indicator.sector_ids.length > 0) {
    text += ` — somente em: ${indicator.sector_ids.map((id) => sectorNames.get(id) ?? "setor removido").join(", ")}`;
  }
  return text;
}

export type PortalRow = {
  "Código no Interact": string;
  Indicador: string;
  Unidade: string;
  Período: string;
  Ocorrência: string;
  Numerador: number | "";
  Denominador: number | "";
  Resultado: string;
  "Unidade de medida": string;
  Meta: string;
  "Situação da meta": string;
  Observação: string;
};

export function buildPortalRows(
  items: { indicator: QualityIndicator; result: QualityResult | undefined; unitName: string }[],
  month: string,
): PortalRow[] {
  return items.map(({ indicator, result, unitName }) => {
    const value = result?.value ?? null;
    const status = targetStatus(value, indicator);
    const target = toNumber(indicator.target_value);
    return {
      "Código no Interact": indicator.interact_code ?? "",
      Indicador: indicator.name,
      Unidade: unitName,
      Período: periodLabel(month),
      Ocorrência: occurrenceLabel(month),
      Numerador: toNumber(result?.numerator) ?? "",
      Denominador: toNumber(result?.denominator) ?? "",
      Resultado: formatForPortal(value, indicator.decimals),
      "Unidade de medida": indicator.result_unit,
      Meta: target === null ? "" : `${indicator.target_comparison === "maximo" ? "máx." : "mín."} ${formatForPortal(target, indicator.decimals)}`,
      "Situação da meta": status === null ? "" : status ? "Atingida" : "Não atingida",
      Observação: missingReason(indicator, result) ?? "",
    };
  });
}
