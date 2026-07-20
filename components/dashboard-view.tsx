"use client";

import { Activity, ArrowDownRight, ArrowUpRight, CalendarDays, Download, TrendingUp, UsersRound } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NamedDateField } from "@/components/ui/date-field";
import { Select } from "@/components/ui/select";
import { ptBRDate, ptBRNumber } from "@/lib/utils";

type Metric = { record_date: string; indicator_code: string; indicator_name: string; kind: string; value: number | string | null };
type Scale = { scale_type: string; assessment_date: string; moment: string; total: number; entry_total: number | null; improved: boolean | null };

const scaleNames: Record<string, string> = { barthel: "Barthel", mrc: "MRC", melhoria_uti: "Melhoria UTI" };

export function DashboardView({ metrics, scales, services, sectors, filters }: { metrics: Metric[]; scales: Scale[]; services: { id: string; name: string }[]; sectors: { id: string; name: string }[]; filters: Record<string, string | undefined> }) {
  const sums = new Map<string, { name: string; value: number }>();
  const daily = new Map<string, Record<string, string | number>>();
  metrics.forEach((metric) => {
    const value = Number(metric.value ?? 0);
    const current = sums.get(metric.indicator_code) ?? { name: metric.indicator_name, value: 0 };
    current.value += value;
    sums.set(metric.indicator_code, current);
    const day = daily.get(metric.record_date) ?? { date: metric.record_date };
    day[metric.indicator_name] = Number(day[metric.indicator_name] ?? 0) + value;
    daily.set(metric.record_date, day);
  });
  const ranked = [...sums.entries()].filter(([, x]) => x.value > 0).sort((a, b) => b[1].value - a[1].value);
  const series = ranked.slice(0, 3);
  const chart = [...daily.values()].map((row) => ({ ...row, label: ptBRDate.format(new Date(`${row.date}T00:00:00Z`)) }));
  const exits = scales.filter((s) => s.moment === "saida" && s.improved !== null);
  const improvements = exits.filter((s) => s.improved).length;
  const improvementRate = exits.length ? (improvements / exits.length) * 100 : 0;
  const assessments = scales.length;

  function exportCsv() {
    const rows = [["Data", "Indicador", "Valor"], ...metrics.map((m) => [m.record_date, m.indicator_name, String(m.value ?? "")])];
    const csv = "\uFEFF" + rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `maisfisio-${filters.de}-${filters.ate}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><h1 className="page-title">Visão geral</h1><p className="page-description">Produção assistencial e evolução clínica no período.</p></div>
        <Button variant="outline" onClick={exportCsv} disabled={!metrics.length}><Download className="size-4" />Exportar CSV</Button>
      </header>
      <Card><CardContent className="pt-5 md:pt-6"><form className="form-grid items-end">
        <div className="field col-span-2"><label className="text-xs font-semibold text-muted-foreground">De</label><NamedDateField name="de" defaultIso={filters.de} /></div>
        <div className="field col-span-2"><label className="text-xs font-semibold text-muted-foreground">Até</label><NamedDateField name="ate" defaultIso={filters.ate} /></div>
        <div className="field col-span-3"><label className="text-xs font-semibold text-muted-foreground">Serviço</label><Select name="servico" defaultValue={filters.servico ?? ""}><option value="">Todos</option>{services.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></div>
        <div className="field col-span-3"><label className="text-xs font-semibold text-muted-foreground">Setor</label><Select name="setor" defaultValue={filters.setor ?? ""}><option value="">Todos</option>{sectors.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></div>
        <Button type="submit" className="col-span-2"><CalendarDays className="size-4" />Aplicar</Button>
      </form></CardContent></Card>
      <section className="metric-grid">
        <MetricCard label={ranked[0]?.[1].name ?? "Produção registrada"} value={ptBRNumber.format(ranked[0]?.[1].value ?? 0)} icon={UsersRound} />
        <MetricCard label="Avaliações completas" value={ptBRNumber.format(assessments)} icon={Activity} />
        <MetricCard label="Saídas com melhora" value={ptBRNumber.format(improvements)} icon={TrendingUp} />
        <MetricCard label="Índice de melhora" value={`${ptBRNumber.format(improvementRate)}%`} icon={improvementRate >= 50 ? ArrowUpRight : ArrowDownRight} accent={improvementRate >= 50} />
      </section>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card><CardHeader><CardTitle>Evolução da produção</CardTitle><CardDescription>Três indicadores com maior volume no período.</CardDescription></CardHeader><CardContent>
          {chart.length ? <div className="h-[330px] w-full"><ResponsiveContainer><AreaChart data={chart} margin={{ left: -15, right: 8 }}><defs>{["#087f5b", "#e09f3e", "#4f70c8"].map((color, i) => <linearGradient key={color} id={`fill-${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color} stopOpacity={0.28}/><stop offset="95%" stopColor={color} stopOpacity={0}/></linearGradient>)}</defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4ebe8"/><XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false}/><YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}/><Tooltip /><Legend />{series.map(([code, item], i) => <Area key={code} type="monotone" dataKey={item.name} stroke={["#087f5b", "#e09f3e", "#4f70c8"][i]} fill={`url(#fill-${i})`} strokeWidth={2} />)}</AreaChart></ResponsiveContainer></div> : <Empty />}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Resultados das escalas</CardTitle><CardDescription>Comparação entre saídas avaliadas.</CardDescription></CardHeader><CardContent className="space-y-5">
          {Object.keys(scaleNames).map((type) => { const all = exits.filter((s) => s.scale_type === type); const better = all.filter((s) => s.improved).length; const rate = all.length ? better / all.length * 100 : 0; return <div key={type}><div className="mb-2 flex justify-between text-sm"><span className="font-medium">{scaleNames[type]}</span><span className="font-semibold">{ptBRNumber.format(rate)}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${rate}%` }} /></div><p className="mt-1.5 text-xs text-muted-foreground">{better} de {all.length} saídas com melhora</p></div>; })}
          {!scales.length && <Empty />}
        </CardContent></Card>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: typeof Activity; accent?: boolean }) {
  return <Card className="overflow-hidden"><CardContent className="relative pt-5 md:pt-6"><div className={`absolute right-4 top-4 grid size-10 place-items-center rounded-xl ${accent ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-secondary-foreground"}`}><Icon className="size-5" /></div><p className="max-w-[75%] truncate text-sm text-muted-foreground" title={label}>{label}</p><p className="mt-2 font-display text-3xl font-bold tracking-tight">{value}</p></CardContent></Card>;
}
function Empty() { return <div className="grid min-h-32 place-items-center rounded-xl border border-dashed text-center text-sm text-muted-foreground">Nenhum dado no período selecionado.</div>; }
