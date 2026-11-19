// B.I. das escalas clínicas: tipos do retorno de scale_bi e regras de leitura
// (faixas clínicas, taxas, transições entre faixas).
import type { ScaleType } from "@/lib/types";

type Num = number | string | null;

export type ScaleBiKpis = {
  avaliacoes: number; incompletas: number; entradas: number; saidas: number; pacientes: number;
  pares: number; melhoraram: number; mantiveram: number; pioraram: number;
  media_entrada: Num; media_saida: Num; ganho_medio: Num; permanencia_media: Num;
};
export type ScaleBiMonth = { mes: string; entradas: number; saidas: number; media_entrada: Num; media_saida: Num; pares: number; melhoraram: number; ganho_medio: Num };
export type ScaleBiSector = { setor: string; entradas: number; saidas: number; media_entrada: Num; media_saida: Num; pares: number; melhoraram: number; ganho_medio: Num; permanencia_media: Num };
export type ScaleBiItem = { item: string; max: number; media_entrada: Num; media_saida: Num };
export type ScaleBi = {
  kpis: ScaleBiKpis;
  mensal: ScaleBiMonth[];
  setores: ScaleBiSector[];
  itens: ScaleBiItem[];
  histograma: Array<{ momento: "entrada" | "saida"; total: number; n: number }>;
  transicoes: Array<{ entrada: number; saida: number; n: number }>;
  colaboradores: Array<{ nome: string; avaliacoes: number; entradas: number; saidas: number }>;
};

export type ScaleBand = { label: string; min: number; max: number; color: string };

export const SCALE_INFO: Record<ScaleType, { name: string; short: string; max: number; higherIsBetter: true; bandsNote: string }> = {
  barthel: { name: "Índice de Barthel", short: "Barthel", max: 100, higherIsBetter: true, bandsNote: "Classificação de dependência do Índice de Barthel." },
  mrc: { name: "Escala MRC", short: "MRC", max: 60, higherIsBetter: true, bandsNote: "MRC-SS: abaixo de 48 indica fraqueza adquirida; abaixo de 36, fraqueza grave." },
  melhoria_uti: { name: "Melhoria Funcional UTI", short: "Melhoria UTI", max: 33, higherIsBetter: true, bandsNote: "Faixas de referência do sistema (terços da pontuação máxima)." },
};

// Da pior para a melhor faixa.
export const SCALE_BANDS: Record<ScaleType, ScaleBand[]> = {
  barthel: [
    { label: "Dependência total", min: 0, max: 20, color: "#b42318" },
    { label: "Dependência severa", min: 21, max: 60, color: "#e8590c" },
    { label: "Dependência moderada", min: 61, max: 90, color: "#d9a400" },
    { label: "Dependência leve", min: 91, max: 99, color: "#4c9f70" },
    { label: "Independente", min: 100, max: 100, color: "#1d5ab0" },
  ],
  mrc: [
    { label: "Fraqueza grave (<36)", min: 0, max: 35, color: "#b42318" },
    { label: "Fraqueza adquirida (36–47)", min: 36, max: 47, color: "#d9a400" },
    { label: "Sem fraqueza relevante (≥48)", min: 48, max: 60, color: "#1d5ab0" },
  ],
  melhoria_uti: [
    { label: "Baixa (0–11)", min: 0, max: 11, color: "#b42318" },
    { label: "Intermediária (12–22)", min: 12, max: 22, color: "#d9a400" },
    { label: "Alta (23–33)", min: 23, max: 33, color: "#1d5ab0" },
  ],
};

export function bandIndex(scale: ScaleType, total: number) {
  const bands = SCALE_BANDS[scale];
  const i = bands.findIndex((b) => total >= b.min && total <= b.max);
  return i === -1 ? (total < bands[0].min ? 0 : bands.length - 1) : i;
}

export function toNumber(value: Num | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Percentual com 1 casa; null quando não há base. */
export function rate(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

/** Contagem por faixa, em entrada e saída. */
export function bandDistribution(scale: ScaleType, histogram: ScaleBi["histograma"]) {
  const rows = SCALE_BANDS[scale].map((b) => ({ faixa: b.label, color: b.color, entrada: 0, saida: 0 }));
  for (const h of histogram) rows[bandIndex(scale, Number(h.total))][h.momento] += Number(h.n);
  const totalIn = rows.reduce((s, r) => s + r.entrada, 0);
  const totalOut = rows.reduce((s, r) => s + r.saida, 0);
  return rows.map((r) => ({ ...r, entradaPct: rate(r.entrada, totalIn) ?? 0, saidaPct: rate(r.saida, totalOut) ?? 0 }));
}

/** Mudança de faixa entre entrada e saída (subiu, ficou, desceu) e matriz entrada × saída. */
export function bandTransitions(scale: ScaleType, transitions: ScaleBi["transicoes"]) {
  const size = SCALE_BANDS[scale].length;
  const matrix = Array.from({ length: size }, () => Array<number>(size).fill(0));
  let up = 0, same = 0, down = 0;
  for (const t of transitions) {
    const from = bandIndex(scale, Number(t.entrada));
    const to = bandIndex(scale, Number(t.saida));
    const n = Number(t.n);
    matrix[from][to] += n;
    if (to > from) up += n; else if (to === from) same += n; else down += n;
  }
  return { matrix, up, same, down, total: up + same + down };
}

export function monthShort(mes: string) {
  const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const [y, m] = mes.split("-");
  return `${names[Number(m) - 1]}/${y.slice(2)}`;
}

export function isScaleType(value: unknown): value is ScaleType {
  return value === "barthel" || value === "mrc" || value === "melhoria_uti";
}

// Qualidade dos registros (scale_data_quality): entradas sem saída e saídas sem entrada.
export type QualityReason = "sem_entrada" | "outro_atendimento" | "entrada_incompleta" | "entrada_posterior";
export type PendingEntry = { id: string; data: string; iniciais: string; prontuario: string; atendimento: string | null; setor_id: string; setor: string | null; dias: number; situacao: "recente" | "antiga" };
export type PendingExit = { id: string; data: string; iniciais: string; prontuario: string; atendimento: string | null; setor_id: string; setor: string | null; motivo: QualityReason; outro_atendimento: string | null; outra_data: string | null };
export type ScaleQuality = {
  resumo: { entradas: number; entradas_sem_saida: number; em_aberto_recente: number; em_aberto_antiga: number; saidas: number; saidas_sem_entrada: number; motivos: Partial<Record<QualityReason, number>>; dias_limite: number };
  mensal: Array<{ mes: string; entradas: number; saidas: number; entradas_sem_saida: number; em_aberto_antiga: number; saidas_sem_entrada: number }>;
  setores: Array<{ setor: string; entradas_sem_saida: number; em_aberto_antiga: number; saidas_sem_entrada: number }>;
  entradas_pendentes: PendingEntry[];
  saidas_pendentes: PendingExit[];
};

export const REASON_LABELS: Record<QualityReason, { label: string; hint: string }> = {
  outro_atendimento: { label: "Entrada com outro atendimento", hint: "Há entrada do paciente nos 90 dias anteriores com outro número de atendimento — provável erro de digitação." },
  entrada_posterior: { label: "Entrada com data depois da saída", hint: "A entrada existe, mas a data ficou depois da saída — confira as datas." },
  entrada_incompleta: { label: "Entrada incompleta", hint: "A entrada existe, mas falta responder algum item." },
  sem_entrada: { label: "Sem entrada registrada", hint: "Nenhuma entrada do paciente para esta escala e atendimento." },
};
