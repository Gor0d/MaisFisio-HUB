"use client";

import Link from "next/link";
import { Activity, ArrowDownRight, ArrowUpRight, CalendarDays, Download, Minus, TrendingUp, UsersRound } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NamedDateField } from "@/components/ui/date-field";
import { Select } from "@/components/ui/select";
import { ptBRDate, ptBRNumber } from "@/lib/utils";

type Metric = { record_date: string; indicator_code: string; indicator_name: string; kind: string; value: number | string | null; service_id: string; sector_id: string | null; shift: string | null; sector_type: string | null };
type Total = { indicator_id: string; indicator_code: string; indicator_name: string; kind: string; derived: boolean; total: number | string | null };
type Scale = { scale_type: string; assessment_date: string; moment: string; total: number; entry_total: number | null; improved: boolean | null };
type Service = { id: string; code: string; name: string };

const scaleNames: Record<string, string> = { barthel: "Barthel", mrc: "MRC", melhoria_uti: "Melhoria UTI" };

// Paleta validada (scripts/validate_palette.js — todos os checks CVD/contraste).
const SERVICE_ORDER = ["fisioterapia", "terapia_ocupacional", "psicologia", "fonoaudiologia", "assistencia_social"];
const THEMES: Record<string, { accent: string; soft: string }> = {
  fisioterapia: { accent: "#087f5b", soft: "#e6f4ef" },
  terapia_ocupacional: { accent: "#d97706", soft: "#faf0e0" },
  psicologia: { accent: "#7c3aed", soft: "#f1ebfc" },
  fonoaudiologia: { accent: "#2563eb", soft: "#e8eefc" },
  assistencia_social: { accent: "#db2777", soft: "#fbe9f1" },
};
const SERIES_COLORS = ["#087f5b", "#d97706", "#2563eb"];

// KPIs de destaque por especialidade (equivalentes aos cartões do B.I. antigo).
const SERVICE_KPIS: Record<string, string[]> = {
  fisioterapia: ["fisio_pacientes_prescritos", "fisio_altas", "fisio_obitos", "fisio_taxa_captados"],
  terapia_ocupacional: ["to_geral_total", "to_enf_atendimentos", "to_enf_altas", "to_amb_individual"],
  psicologia: ["psi_atendimentos", "psi_admissoes", "psi_familiar", "psi_risco_suicidio"],
  fonoaudiologia: ["fono_atendimentos", "fono_altas", "fono_melhorias", "fono_broncoaspiracoes"],
  assistencia_social: ["social_atendimentos", "social_acolhimento", "social_alta", "social_evasoes"],
};
const KPI_LABELS: Record<string, string> = {
  fisio_pacientes_prescritos: "Pacientes Prescritos", fisio_altas: "Altas", fisio_obitos: "Óbitos", fisio_taxa_captados: "Taxa de Captação",
  to_geral_total: "Atendimentos Gerais", to_enf_atendimentos: "Atendimentos na Enfermaria", to_enf_altas: "Altas da Enfermaria", to_amb_individual: "Atendimentos no Ambulatório",
  psi_atendimentos: "Atendimentos Realizados", psi_admissoes: "Admissões", psi_familiar: "Atendimento Familiar", psi_risco_suicidio: "Protocolo Risco de Suicídio",
  fono_atendimentos: "Atendimentos Realizados", fono_altas: "Altas da Fono", fono_melhorias: "Melhorias na Fonoterapia", fono_broncoaspiracoes: "Broncoaspirações",
  social_atendimentos: "Atendimentos Realizados", social_acolhimento: "Acolhimentos", social_alta: "Altas Hospitalares", social_evasoes: "Evasões",
};

export function DashboardView({ metrics, totals, previousTotals, scales, services, sectors, filters }: { metrics: Metric[]; totals: Total[]; previousTotals: Total[]; scales: Scale[]; services: Service[]; sectors: { id: string; name: string }[]; filters: Record<string, string | undefined> }) {
  const orderedServices = SERVICE_ORDER.map((code) => services.find((s) => s.code === code)).filter((s): s is Service => Boolean(s));
  const activeService = services.find((s) => s.id === filters.servico);
  const theme = THEMES[activeService?.code ?? ""] ?? THEMES.fisioterapia;
  const sectorName = new Map(sectors.map((s) => [s.id, s.name]));
  const previousByCode = new Map(previousTotals.map((t) => [t.indicator_code, t]));

  const tabHref = (servico?: string) => {
    const params = new URLSearchParams();
    if (filters.de) params.set("de", filters.de);
    if (filters.ate) params.set("ate", filters.ate);
    if (filters.setor) params.set("setor", filters.setor);
    if (servico) params.set("servico", servico);
    return `/dashboard?${params.toString()}`;
  };

  // Ranking e gráfico de tendência: só indicadores de contagem entram aqui —
  // somar uma "taxa" (percentual) dia a dia não tem leitura válida (área
  // empilhada de percentuais); os totais corretos por indicador já vêm
  // agregados do banco (production_metrics_totals) em `totals`.
  const ranked = totals.filter((t) => t.kind !== "taxa" && Number(t.total ?? 0) > 0).sort((a, b) => Number(b.total) - Number(a.total));
  const series = ranked.slice(0, 3);
  const seriesCodes = new Set(series.map((s) => s.indicator_code));
  const daily = new Map<string, Record<string, string | number>>();
  metrics.forEach((metric) => {
    if (!seriesCodes.has(metric.indicator_code)) return;
    const day = daily.get(metric.record_date) ?? { date: metric.record_date };
    day[metric.indicator_name] = Number(day[metric.indicator_name] ?? 0) + Number(metric.value ?? 0);
    daily.set(metric.record_date, day);
  });
  const chart = [...daily.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))).map((row) => ({ ...row, label: ptBRDate.format(new Date(`${row.date}T00:00:00Z`)) }));

  const exits = scales.filter((s) => s.moment === "saida" && s.improved !== null);
  const improvements = exits.filter((s) => s.improved).length;
  const improvementRate = exits.length ? (improvements / exits.length) * 100 : 0;

  // KPIs da especialidade com variação vs período anterior de mesma duração —
  // ambos os totais já vêm corretamente agregados do banco (soma, média ou
  // soma(numerador)/soma(denominador), conforme o indicador).
  const kpis = (SERVICE_KPIS[activeService?.code ?? ""] ?? []).map((code) => {
    const row = totals.find((t) => t.indicator_code === code);
    const current = Number(row?.total ?? 0);
    const prevRow = previousByCode.get(code);
    const prev = prevRow?.total != null ? Number(prevRow.total) : null;
    const delta = prev ? ((current - prev) / prev) * 100 : null;
    return { code, label: row?.indicator_name ?? KPI_LABELS[code] ?? code, value: current, kind: row?.kind, delta };
  });
  const primaryCode = SERVICE_KPIS[activeService?.code ?? ""]?.[0];
  const primaryRows = metrics.filter((x) => x.indicator_code === primaryCode);
  const primaryKind = totals.find((t) => t.indicator_code === primaryCode)?.kind;
  const primaryLabel = primaryRows[0]?.indicator_name ?? KPI_LABELS[primaryCode ?? ""] ?? "";

  const byDimension = (key: "shift" | "sector_id" | "sector_type", order?: string[]) => {
    const sums = new Map<string, number>();
    const counts = new Map<string, number>();
    primaryRows.forEach((x) => { const raw = x[key]; if (!raw) return; const label = key === "sector_id" ? sectorName.get(raw) ?? "Outro" : raw; sums.set(label, (sums.get(label) ?? 0) + Number(x.value ?? 0)); counts.set(label, (counts.get(label) ?? 0) + 1); });
    // Taxa: média por grupo (nunca soma de percentuais); contagem: soma normal.
    const entries = [...sums.entries()].map(([label, sum]) => ({ label, value: primaryKind === "taxa" ? sum / (counts.get(label) ?? 1) : sum }));
    return order ? order.map((label) => entries.find((e) => e.label === label) ?? { label, value: 0 }).filter((e) => e.value > 0 || entries.some((x) => x.label === e.label)) : entries.sort((a, b) => b.value - a.value);
  };

  function exportCsv() {
    const rows = [["Data", "Indicador", "Valor"], ...metrics.map((m) => [m.record_date, m.indicator_name, String(m.value ?? "")])];
    const csv = "﻿" + rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `maisfisio-${filters.de}-${filters.ate}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  const showScales = !activeService || activeService.code === "fisioterapia";

  return (
    <div className="grid gap-6">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><h1 className="page-title">{activeService ? activeService.name : "Visão geral"}</h1><p className="page-description">{activeService ? `Produção de ${activeService.name} no período.` : "Produção assistencial e evolução clínica no período."}</p></div>
        <Button variant="outline" onClick={exportCsv} disabled={!metrics.length}><Download className="size-4" />Exportar CSV</Button>
      </header>

      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Especialidades">
        <Link href={tabHref()} className={`flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition-colors ${!activeService ? "border-transparent bg-foreground text-background" : "bg-card hover:bg-muted"}`}>Visão geral</Link>
        {orderedServices.map((service) => { const t = THEMES[service.code]; const active = activeService?.id === service.id; return (
          <Link key={service.id} href={tabHref(service.id)} className={`flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${active ? "border-transparent text-white" : "bg-card hover:bg-muted"}`} style={active ? { background: t.accent } : undefined}>
            {!active && <span className="size-2.5 rounded-full" style={{ background: t.accent }} aria-hidden />}{service.name}
          </Link>
        ); })}
      </nav>

      <Card><CardContent className="pt-5 md:pt-6"><form className="form-grid items-end">
        {filters.servico && <input type="hidden" name="servico" value={filters.servico} />}
        <div className="field col-span-2"><label className="text-xs font-semibold text-muted-foreground">De</label><NamedDateField name="de" defaultIso={filters.de} /></div>
        <div className="field col-span-2"><label className="text-xs font-semibold text-muted-foreground">Até</label><NamedDateField name="ate" defaultIso={filters.ate} /></div>
        <div className="field col-span-3"><label className="text-xs font-semibold text-muted-foreground">Setor</label><Select name="setor" defaultValue={filters.setor ?? ""}><option value="">Todos</option>{sectors.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></div>
        <Button type="submit" className="col-span-2" style={{ background: theme.accent }}><CalendarDays className="size-4" />Aplicar</Button>
      </form></CardContent></Card>

      {activeService ? (
        <section className="metric-grid">
          {kpis.map((kpi) => <KpiCard key={kpi.code} label={kpi.label} value={kpi.kind === "taxa" ? `${ptBRNumber.format(kpi.value)}%` : ptBRNumber.format(kpi.value)} delta={kpi.delta} accent={theme.accent} soft={theme.soft} />)}
        </section>
      ) : (
        <section className="metric-grid">
          <MetricCard label={ranked[0]?.indicator_name ?? "Produção registrada"} value={ptBRNumber.format(Number(ranked[0]?.total ?? 0))} icon={UsersRound} />
          <MetricCard label="Avaliações completas" value={ptBRNumber.format(scales.length)} icon={Activity} />
          <MetricCard label="Saídas com melhora" value={ptBRNumber.format(improvements)} icon={TrendingUp} />
          <MetricCard label="Índice de melhora" value={`${ptBRNumber.format(improvementRate)}%`} icon={improvementRate >= 50 ? ArrowUpRight : ArrowDownRight} accent={improvementRate >= 50} />
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card><CardHeader><CardTitle>Evolução da produção</CardTitle><CardDescription>Três indicadores com maior volume no período.</CardDescription></CardHeader><CardContent>
          {chart.length ? <div className="h-[330px] w-full"><ResponsiveContainer><AreaChart data={chart} margin={{ left: -15, right: 8 }}><defs>{SERIES_COLORS.map((color, i) => <linearGradient key={color} id={`fill-${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color} stopOpacity={0.28}/><stop offset="95%" stopColor={color} stopOpacity={0}/></linearGradient>)}</defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4ebe8"/><XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false}/><YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}/><Tooltip /><Legend />{series.map((item, i) => <Area key={item.indicator_code} type="monotone" dataKey={item.indicator_name} stroke={SERIES_COLORS[i]} fill={`url(#fill-${i})`} strokeWidth={2} />)}</AreaChart></ResponsiveContainer></div> : <Empty />}
        </CardContent></Card>

        {showScales ? (
          <Card><CardHeader><CardTitle>Resultados das escalas</CardTitle><CardDescription>Comparação entre saídas avaliadas.</CardDescription></CardHeader><CardContent className="space-y-5">
            {Object.keys(scaleNames).map((type) => { const all = exits.filter((s) => s.scale_type === type); const better = all.filter((s) => s.improved).length; const rate = all.length ? better / all.length * 100 : 0; return <div key={type}><div className="mb-2 flex justify-between text-sm"><span className="font-medium">{scaleNames[type]}</span><span className="font-semibold">{ptBRNumber.format(rate)}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-all" style={{ width: `${rate}%`, background: theme.accent }} /></div><p className="mt-1.5 text-xs text-muted-foreground">{better} de {all.length} saídas com melhora</p></div>; })}
            {!scales.length && <Empty />}
          </CardContent></Card>
        ) : (
          <BreakdownCard title={`${primaryLabel} por turno`} data={byDimension("shift", ["MANHÃ", "TARDE", "NOITE"])} accent={theme.accent} />
        )}
      </div>

      {activeService && (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {showScales && <BreakdownCard title={`${primaryLabel} por turno`} data={byDimension("shift", ["MANHÃ", "TARDE", "NOITE"])} accent={theme.accent} />}
          <BreakdownCard title={`${primaryLabel} por setor`} data={byDimension("sector_id")} accent={theme.accent} />
          <BreakdownCard title={`${primaryLabel} por tipo de setor`} data={byDimension("sector_type", ["Médica", "Ortopédica", "Cirúrgica"])} accent={theme.accent} />
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, delta, accent, soft }: { label: string; value: string; delta: number | null; accent: string; soft: string }) {
  const Arrow = delta === null ? Minus : delta >= 0 ? ArrowUpRight : ArrowDownRight;
  return <Card className="overflow-hidden border-t-4" style={{ borderTopColor: accent }}><CardContent className="pt-5 md:pt-6">
    <p className="truncate text-sm text-muted-foreground" title={label}>{label}</p>
    <p className="mt-2 font-display text-3xl font-bold tracking-tight tabular-nums">{value}</p>
    <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground"><span className="grid size-5 place-items-center rounded-full" style={{ background: soft, color: accent }}><Arrow className="size-3.5" /></span>{delta === null ? "sem período anterior" : `${delta >= 0 ? "+" : ""}${ptBRNumber.format(delta)}% vs período anterior`}</p>
  </CardContent></Card>;
}

function BreakdownCard({ title, data, accent }: { title: string; data: { label: string; value: number }[]; accent: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return <Card><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent>
    {data.length ? <div className="grid gap-3">{data.map((d) => (
      <div key={d.label} className="grid grid-cols-[minmax(90px,120px)_1fr_auto] items-center gap-3 text-sm">
        <span className="truncate text-muted-foreground" title={d.label}>{d.label}</span>
        <div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: accent }} /></div>
        <strong className="tabular-nums">{ptBRNumber.format(d.value)}</strong>
      </div>
    ))}</div> : <Empty />}
  </CardContent></Card>;
}

function MetricCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: typeof Activity; accent?: boolean }) {
  return <Card className="overflow-hidden"><CardContent className="relative pt-5 md:pt-6"><div className={`absolute right-4 top-4 grid size-10 place-items-center rounded-xl ${accent ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-secondary-foreground"}`}><Icon className="size-5" /></div><p className="max-w-[75%] truncate text-sm text-muted-foreground" title={label}>{label}</p><p className="mt-2 font-display text-3xl font-bold tracking-tight">{value}</p></CardContent></Card>;
}
function Empty() { return <div className="grid min-h-32 place-items-center rounded-xl border border-dashed text-center text-sm text-muted-foreground">Nenhum dado no período selecionado.</div>; }
