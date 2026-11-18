"use client";

import Link from "next/link";
import { Activity, ArrowDownRight, ArrowUpRight, CalendarDays, Download, FileSpreadsheet, LoaderCircle, Minus, TrendingUp, UsersRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NamedDateField } from "@/components/ui/date-field";
import { Select } from "@/components/ui/select";
import { KPI_LABELS, SERVICE_KPIS, SERVICE_ORDER, THEMES } from "@/lib/service-themes";
import { effectiveTarget, targetSituation, type IndicatorTarget, type TargetSituation } from "@/lib/targets";
import { createClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/pagination";
import { ptBRDate, ptBRNumber } from "@/lib/utils";

// Linha bruta só para exportação (buscada sob demanda, nunca no carregamento).
type Metric = { record_date: string; indicator_code: string; indicator_name: string; kind: string; value: number | string | null; service_id: string; sector_id: string | null; unit_id: string; shift: string | null; sector_type: string | null; collaborator_id: string | null; collaborator_ids?: string[] | null; context: string };
// Agregado vindo de production_metrics_grouped (por dia/mês ou por dimensão).
export type Grouped = { bucket: string; indicator_id: string; indicator_code: string; indicator_name: string; kind: string; derived: boolean; total: number | string | null; records: number };
export type Breakdowns = { shift: Grouped[]; sector: Grouped[]; sector_type: Grouped[] };
type Total = { indicator_id: string; indicator_code: string; indicator_name: string; kind: string; derived: boolean; total: number | string | null };
type Scale = { scale_type: string; assessment_date: string; moment: string; total: number; entry_total: number | null; improved: boolean | null };
type Service = { id: string; code: string; name: string };
type Collaborator = { id: string; canonical_name: string; service_id: string };
type Unit = { id: string; name: string };

const scaleNames: Record<string, string> = { barthel: "Barthel", mrc: "MRC", melhoria_uti: "Melhoria UTI" };
const SERIES_COLORS = ["#1d5ab0", "#d97706", "#0891b2"];


export function DashboardView({ trend, grain, breakdowns, totals, previousTotals, scales, services, sectors, collaborators, collaboratorNames, units, targets, activeUnitId, filters }: { trend: Grouped[]; grain: "day" | "month"; breakdowns: Breakdowns; totals: Total[]; previousTotals: Total[]; scales: Scale[]; services: Service[]; sectors: { id: string; name: string }[]; collaborators: Collaborator[]; collaboratorNames: { id: string; canonical_name: string }[]; units: Unit[]; targets: IndicatorTarget[]; activeUnitId: string | null; filters: Record<string, string | undefined> }) {
  const orderedServices = SERVICE_ORDER.map((code) => services.find((s) => s.code === code)).filter((s): s is Service => Boolean(s));
  const activeService = services.find((s) => s.id === filters.servico);
  const theme = THEMES[activeService?.code ?? ""] ?? THEMES.fisioterapia;
  const sectorName = new Map(sectors.map((s) => [s.id, s.name]));
  const serviceName = new Map(services.map((service) => [service.id, service.name]));
  const collaboratorName = new Map(collaboratorNames.map((collaborator) => [collaborator.id, collaborator.canonical_name]));
  const unitName = new Map(units.map((unit) => [unit.id, unit.name]));
  const previousByCode = new Map(previousTotals.map((t) => [t.indicator_code, t]));

  const tabHref = (servico?: string) => {
    const params = new URLSearchParams();
    if (filters.de) params.set("de", filters.de);
    if (filters.ate) params.set("ate", filters.ate);
    if (filters.setor) params.set("setor", filters.setor);
    if (filters.turno) params.set("turno", filters.turno);
    if (filters.colaborador) params.set("colaborador", filters.colaborador);
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
  // Série já agregada pelo banco (por dia em períodos curtos, por mês nos longos).
  const daily = new Map<string, Record<string, string | number>>();
  trend.forEach((row) => {
    if (!seriesCodes.has(row.indicator_code)) return;
    const point = daily.get(row.bucket) ?? { date: row.bucket };
    point[row.indicator_name] = Number(row.total ?? 0);
    daily.set(row.bucket, point);
  });
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" });
  const chart = [...daily.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))).map((row) => ({ ...row, label: grain === "month" ? monthLabel.format(new Date(`${row.date}-01T00:00:00Z`)) : ptBRDate.format(new Date(`${row.date}T00:00:00Z`)) }));

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
    const target = row
      ? effectiveTarget(targets, row.indicator_id, activeUnitId, filters.setor ?? null)
      : null;
    return { code, label: row?.indicator_name ?? KPI_LABELS[code] ?? code, value: current, kind: row?.kind, delta, situation: targetSituation(current, target) };
  });
  const primaryCode = SERVICE_KPIS[activeService?.code ?? ""]?.[0];
  const primaryLabel = totals.find((t) => t.indicator_code === primaryCode)?.indicator_name ?? KPI_LABELS[primaryCode ?? ""] ?? "";

  // Quebras do indicador principal já agregadas pelo banco (soma, média ou
  // soma(numerador)/soma(denominador), conforme o tipo — nunca soma de %).
  const byDimension = (key: "shift" | "sector_id" | "sector_type", order?: string[]) => {
    const source = key === "sector_id" ? breakdowns.sector : breakdowns[key];
    const entries = source
      .filter((row) => row.indicator_code === primaryCode && row.bucket)
      .map((row) => ({ label: key === "sector_id" ? sectorName.get(row.bucket) ?? "Outro" : row.bucket, value: Number(row.total ?? 0) }));
    return order ? order.map((label) => entries.find((e) => e.label === label) ?? { label, value: 0 }).filter((e) => e.value > 0 || entries.some((x) => x.label === e.label)) : entries.sort((a, b) => b.value - a.value);
  };

  const [exporting, setExporting] = useState(false);
  // Linhas brutas só quando alguém exporta: carregar tudo na abertura do
  // dashboard custava ~14 s em 12 meses (~197 mil linhas).
  async function loadExportRows() {
    const supabase = createClient();
    const metrics = await fetchAllRows<Metric>((from, to) => {
      let q = supabase.from("production_metrics").select("record_date,indicator_code,indicator_name,kind,value,service_id,sector_id,unit_id,shift,sector_type,collaborator_id,collaborator_ids,context").gte("record_date", filters.de!).lte("record_date", filters.ate!).order("record_date");
      if (activeUnitId) q = q.eq("unit_id", activeUnitId);
      if (filters.servico) q = q.eq("service_id", filters.servico);
      if (filters.setor) q = q.eq("sector_id", filters.setor);
      if (filters.turno) q = q.eq("shift", filters.turno);
      if (filters.colaborador) q = q.contains("collaborator_ids", [filters.colaborador]);
      return q.range(from, to);
    });
    return metrics.map((metric) => ({
    Unidade: unitName.get(metric.unit_id) ?? "Todas as unidades",
    Data: metric.record_date,
    Serviço: serviceName.get(metric.service_id) ?? "",
    Turno: metric.shift ?? "",
    Setor: sectorName.get(metric.sector_id ?? "") ?? "",
    "Tipo de setor": metric.sector_type ?? "",
    Colaborador: (metric.collaborator_ids?.length ? metric.collaborator_ids : [metric.collaborator_id]).map((id) => collaboratorName.get(id ?? "") ?? "").filter(Boolean).join(", "),
    Contexto: metric.context,
    "Código do indicador": metric.indicator_code,
    Indicador: metric.indicator_name,
    Tipo: metric.kind,
    Valor: metric.value ?? "",
  }));
  }

  async function withExportRows(run: (rows: Awaited<ReturnType<typeof loadExportRows>>) => Promise<void> | void) {
    setExporting(true);
    try {
      const rows = await loadExportRows();
      if (!rows.length) { toast.info("Não há lançamentos no período e filtros escolhidos."); return; }
      await run(rows);
    } catch {
      toast.error("Não foi possível gerar a exportação. Tente um período menor.");
    } finally {
      setExporting(false);
    }
  }

  const exportCsv = () => withExportRows((exportRows) => {
    const headers = Object.keys(exportRows[0] ?? {});
    const rows = [headers, ...exportRows.map((row) => headers.map((header) => row[header as keyof typeof row]))];
    const csv = "\uFEFF" + rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `maisfisio-${filters.de}-${filters.ate}.csv`; link.click(); URL.revokeObjectURL(url);
  });

  const exportExcel = () => withExportRows(async (exportRows) => {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Produção assistencial");
    XLSX.writeFile(workbook, `maisfisio-${filters.de}-${filters.ate}.xlsx`, { compression: true });
  });

  const showScales = !activeService || activeService.code === "fisioterapia";

  return (
    <div className="grid gap-6">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><h1 className="page-title">{activeService ? activeService.name : "Visão geral"}</h1><p className="page-description">{activeService ? `Produção de ${activeService.name} no período.` : "Produção assistencial e evolução clínica no período."}</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={exportCsv} disabled={exporting}>{exporting ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}Exportar CSV</Button><Button variant="outline" onClick={exportExcel} disabled={exporting}>{exporting ? <LoaderCircle className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}Exportar Excel</Button></div>
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
        <div className="field col-span-2"><label className="text-xs font-semibold text-muted-foreground">Turno</label><Select name="turno" defaultValue={filters.turno ?? ""}><option value="">Todos</option><option value="MANHÃ">Manhã</option><option value="TARDE">Tarde</option><option value="NOITE">Noite</option></Select></div>
        <div className="field col-span-4"><label className="text-xs font-semibold text-muted-foreground">Colaborador</label><Select name="colaborador" defaultValue={filters.colaborador ?? ""}><option value="">Todos</option>{collaborators.map((collaborator) => <option key={collaborator.id} value={collaborator.id}>{collaborator.canonical_name} · {serviceName.get(collaborator.service_id) ?? "Serviço"}</option>)}</Select></div>
        <Button type="submit" className="col-span-2" style={{ background: theme.accent }}><CalendarDays className="size-4" />Aplicar</Button>
      </form></CardContent></Card>

      {activeService ? (
        <section className="metric-grid">
          {kpis.map((kpi) => <KpiCard key={kpi.code} label={kpi.label} value={kpi.kind === "taxa" ? `${ptBRNumber.format(kpi.value)}%` : ptBRNumber.format(kpi.value)} kind={kpi.kind} delta={kpi.delta} situation={kpi.situation} accent={theme.accent} soft={theme.soft} />)}
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
        <Card><CardHeader><CardTitle>Evolução da produção</CardTitle><CardDescription>Três indicadores com maior volume no período{grain === "month" ? ", por mês" : ", por dia"}.</CardDescription></CardHeader><CardContent>
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

function KpiCard({ label, value, kind, delta, situation, accent, soft }: { label: string; value: string; kind?: string; delta: number | null; situation: TargetSituation | null; accent: string; soft: string }) {
  const Arrow = delta === null ? Minus : delta >= 0 ? ArrowUpRight : ArrowDownRight;
  const targetValue = situation
    ? `${ptBRNumber.format(Number(situation.target.target_value))}${kind === "taxa" ? "%" : ""}`
    : null;
  return <Card className="overflow-hidden border-t-4" style={{ borderTopColor: accent }}><CardContent className="pt-5 md:pt-6">
    <p className="truncate text-sm text-muted-foreground" title={label}>{label}</p>
    <p className="mt-2 font-display text-3xl font-bold tracking-tight tabular-nums">{value}</p>
    <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground"><span className="grid size-5 place-items-center rounded-full" style={{ background: soft, color: accent }}><Arrow className="size-3.5" /></span>{delta === null ? "sem período anterior" : `${delta >= 0 ? "+" : ""}${ptBRNumber.format(delta)}% vs período anterior`}</p>
    {situation && <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-xs"><Badge className={situation.achieved ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>{situation.achieved ? "Meta atingida" : "Meta não atingida"}</Badge><span className="text-muted-foreground">Meta {situation.target.comparison === "maximo" ? "≤" : "≥"} {targetValue}</span></div>}
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
