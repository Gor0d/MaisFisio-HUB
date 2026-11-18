// Modelo do relatório mensal (tela, PDF e Excel usam os mesmos números).
import { effectiveTarget, targetSituation, type IndicatorTarget } from "@/lib/targets";
import { SERVICE_KPIS, SERVICE_ORDER, THEMES } from "@/lib/service-themes";

export type ReportTotal = { indicator_id: string; indicator_code: string; indicator_name: string; kind: string; derived: boolean; total: number | string | null };
export type ReportCatalogItem = { id: string; display_order: number | null; context: string | null; service_code: string; service_name: string };
export type ReportScaleRow = { scale_type: string; moment: string; total: number; improved: boolean | null };

export type ReportRow = {
  id: string;
  code: string;
  name: string;
  context: string | null;
  kind: string;
  value: number;
  previous: number | null;
  /** contagem: variação relativa (0,1 = +10%); taxa: diferença em pontos percentuais */
  delta: number | null;
  deltaKind: "relativa" | "pp";
  target: { value: number; comparison: "minimo" | "maximo" } | null;
  achieved: boolean | null;
  highlight: boolean;
};
export type ReportService = { code: string; name: string; accent: string; soft: string; rows: ReportRow[] };
export type ReportScale = { name: string; assessments: number; exits: number; improved: number; rate: number | null };
export type MonthlyReport = {
  month: string;
  monthLabel: string;
  previousMonthLabel: string;
  unitName: string;
  generatedAt: Date;
  services: ReportService[];
  scales: ReportScale[];
  summary: { indicators: number; targetsTotal: number; targetsAchieved: number; assessments: number; improvementRate: number | null };
};

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SCALE_NAMES: Record<string, string> = { barthel: "Barthel", mrc: "MRC", melhoria_uti: "Melhoria UTI" };
const CONTEXT_LABELS: Record<string, string> = { uti: "UTI", enfermaria: "Enfermaria", ambulatorio: "Ambulatório" };

export function monthLabel(month: string) {
  return `${MONTHS[Number(month.slice(5, 7)) - 1]} de ${month.slice(0, 4)}`;
}

export function previousMonth(month: string) {
  const year = Number(month.slice(0, 4)); const m = Number(month.slice(5, 7));
  return m === 1 ? `${year - 1}-12` : `${year}-${String(m - 1).padStart(2, "0")}`;
}

export function contextLabel(context: string | null) {
  return context && CONTEXT_LABELS[context] ? CONTEXT_LABELS[context] : null;
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function buildMonthlyReport(input: {
  month: string;
  unitName: string;
  activeUnitId: string | null;
  totals: ReportTotal[];
  previousTotals: ReportTotal[];
  catalog: ReportCatalogItem[];
  targets: IndicatorTarget[];
  scales: ReportScaleRow[];
  generatedAt?: Date;
}): MonthlyReport {
  const catalog = new Map(input.catalog.map((item) => [item.id, item]));
  const previous = new Map(input.previousTotals.map((t) => [t.indicator_id, toNumber(t.total)]));
  const byService = new Map<string, ReportService>();
  let targetsTotal = 0; let targetsAchieved = 0;

  for (const total of input.totals) {
    const value = toNumber(total.total);
    if (value === null || total.kind === "texto") continue;
    const info = catalog.get(total.indicator_id);
    const serviceCode = info?.service_code ?? "outros";
    if (!byService.has(serviceCode)) {
      const theme = THEMES[serviceCode] ?? { accent: "#2e5080", soft: "#eef2f7" };
      byService.set(serviceCode, { code: serviceCode, name: info?.service_name ?? "Outros", accent: theme.accent, soft: theme.soft, rows: [] });
    }
    const prev = previous.get(total.indicator_id) ?? null;
    const isRate = total.kind === "taxa";
    const delta = prev === null ? null : isRate ? value - prev : prev === 0 ? null : (value - prev) / prev;
    const situation = targetSituation(value, effectiveTarget(input.targets, total.indicator_id, input.activeUnitId, null));
    if (situation) { targetsTotal += 1; if (situation.achieved) targetsAchieved += 1; }
    byService.get(serviceCode)!.rows.push({
      id: total.indicator_id,
      code: total.indicator_code,
      name: total.indicator_name,
      context: info?.context ?? null,
      kind: total.kind,
      value,
      previous: prev,
      delta,
      deltaKind: isRate ? "pp" : "relativa",
      target: situation ? { value: Number(situation.target.target_value), comparison: situation.target.comparison === "maximo" ? "maximo" : "minimo" } : null,
      achieved: situation ? situation.achieved : null,
      highlight: (SERVICE_KPIS[serviceCode] ?? []).includes(total.indicator_code),
    });
  }

  const order = (code: string) => { const i = SERVICE_ORDER.indexOf(code); return i < 0 ? 99 : i; };
  const services = [...byService.values()].sort((a, b) => order(a.code) - order(b.code));
  for (const service of services) {
    service.rows.sort((a, b) => (catalog.get(a.id)?.display_order ?? 999) - (catalog.get(b.id)?.display_order ?? 999) || a.name.localeCompare(b.name, "pt-BR"));
  }

  const scales = Object.keys(SCALE_NAMES).map((type) => {
    const all = input.scales.filter((x) => x.scale_type === type);
    const exits = all.filter((x) => x.moment === "saida" && x.improved !== null);
    const improved = exits.filter((x) => x.improved).length;
    return { name: SCALE_NAMES[type], assessments: all.length, exits: exits.length, improved, rate: exits.length ? (improved / exits.length) * 100 : null };
  });
  const exits = scales.reduce((s, x) => s + x.exits, 0);
  const improved = scales.reduce((s, x) => s + x.improved, 0);

  return {
    month: input.month,
    monthLabel: monthLabel(input.month),
    previousMonthLabel: monthLabel(previousMonth(input.month)),
    unitName: input.unitName,
    generatedAt: input.generatedAt ?? new Date(),
    services,
    scales,
    summary: {
      indicators: services.reduce((s, x) => s + x.rows.length, 0),
      targetsTotal,
      targetsAchieved,
      assessments: scales.reduce((s, x) => s + x.assessments, 0),
      improvementRate: exits ? (improved / exits) * 100 : null,
    },
  };
}

const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatValue(row: Pick<ReportRow, "kind">, value: number | null) {
  if (value === null) return "—";
  return row.kind === "taxa" ? `${percent.format(value)}%` : number.format(value);
}

export function formatDelta(row: Pick<ReportRow, "delta" | "deltaKind">) {
  if (row.delta === null) return "—";
  if (Math.abs(row.delta) < 1e-9) return "estável";
  const sign = row.delta > 0 ? "+" : "-";
  return row.deltaKind === "pp" ? `${sign}${percent.format(Math.abs(row.delta))} p.p.` : `${sign}${percent.format(Math.abs(row.delta) * 100)}%`;
}

export function formatTarget(row: Pick<ReportRow, "target" | "kind">) {
  if (!row.target) return "—";
  return `${row.target.comparison === "maximo" ? "máx." : "mín."} ${formatValue(row, row.target.value)}`;
}

export function situationLabel(row: Pick<ReportRow, "achieved">) {
  return row.achieved === null ? "—" : row.achieved ? "Atingida" : "Não atingida";
}
