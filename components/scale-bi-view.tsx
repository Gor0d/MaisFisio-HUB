"use client";

import Link from "next/link";
import { Activity, ArrowDownRight, ArrowUpRight, CalendarDays, Clock3, FileSpreadsheet, LoaderCircle, Minus, TrendingUp, UsersRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NamedDateField } from "@/components/ui/date-field";
import { Select } from "@/components/ui/select";
import { SCALE_BANDS, SCALE_INFO, bandDistribution, bandTransitions, monthShort, rate, toNumber, type ScaleBi, type ScaleQuality } from "@/lib/scale-bi";
import { ScaleQualitySection } from "@/components/scale-quality";
import type { ScaleType } from "@/lib/types";
import { cn, ptBRNumber } from "@/lib/utils";

const ENTRY = "#94a3b8";
const EXIT = "#1d5ab0";
const GOOD = "#2f9e44";
const BAD = "#c92a2a";
const GRID = "#e4ebe8";

const fmt = (value: number | string | null | undefined, suffix = "") => {
  const n = toNumber(value ?? null);
  return n === null ? "—" : `${ptBRNumber.format(n)}${suffix}`;
};
const pct = (value: number | null) => (value === null ? "—" : `${ptBRNumber.format(value)}%`);

type Filters = { de: string; ate: string; setor: string | null };

export function ScaleBiView({ scale, data, error, sectors, filters, unitName, today, quality, collaborators }: { scale: ScaleType; data: ScaleBi | null; error: string | null; sectors: { id: string; name: string }[]; filters: Filters; unitName: string; today: string; quality: ScaleQuality | null; collaborators: { id: string; name: string }[] }) {
  const info = SCALE_INFO[scale];
  const k = data?.kpis;
  const improvementRate = k ? rate(k.melhoraram, k.pares) : null;
  const worseRate = k ? rate(k.pioraram, k.pares) : null;
  const qs = (escala: string) => {
    const p = new URLSearchParams({ escala, de: filters.de, ate: filters.ate });
    if (filters.setor) p.set("setor", filters.setor);
    return `/escalas/painel?${p}`;
  };

  const monthly = (data?.mensal ?? []).map((m) => ({
    label: monthShort(m.mes),
    Entradas: m.entradas,
    Saídas: m.saidas,
    Melhoraram: m.melhoraram,
    "Taxa de melhora (%)": rate(m.melhoraram, m.pares),
    "Média na entrada": toNumber(m.media_entrada),
    "Média na saída": toNumber(m.media_saida),
  }));
  const distribution = data ? bandDistribution(scale, data.histograma) : [];
  const transitions = data ? bandTransitions(scale, data.transicoes) : null;
  const items = (data?.itens ?? []).map((i) => ({
    item: i.item,
    Entrada: i.max ? Math.round(((toNumber(i.media_entrada) ?? 0) / i.max) * 1000) / 10 : 0,
    Saída: i.max ? Math.round(((toNumber(i.media_saida) ?? 0) / i.max) * 1000) / 10 : 0,
    entradaPts: toNumber(i.media_entrada),
    saidaPts: toNumber(i.media_saida),
    max: i.max,
  }));
  const empty = !k || k.avaliacoes === 0;
  const sectorName = filters.setor ? sectors.find((s) => s.id === filters.setor)?.name ?? "Setor" : "Todos os setores";

  return <div className="grid grid-cols-1 gap-6">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="page-title">B.I. das escalas</h1><p className="page-description">{unitName} · acompanhamento de entrada, saída e evolução funcional dos pacientes.</p></div>
      {data && !empty && <ExportButton scale={scale} data={data} filters={filters} unitName={unitName} sectorName={sectorName} />}
    </header>

    <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Escalas">
      {(Object.keys(SCALE_INFO) as ScaleType[]).map((s) => <Link key={s} href={qs(s)} prefetch={false} aria-current={s === scale ? "page" : undefined} className={buttonVariants({ variant: s === scale ? "default" : "outline" })}>{SCALE_INFO[s].name}</Link>)}
    </nav>

    <Card><CardContent className="pt-5 md:pt-6"><form className="form-grid items-end">
      <input type="hidden" name="escala" value={scale} />
      <div className="field col-span-3"><label className="text-xs font-semibold text-muted-foreground">De</label><NamedDateField name="de" defaultIso={filters.de} maxIso={today} /></div>
      <div className="field col-span-3"><label className="text-xs font-semibold text-muted-foreground">Até</label><NamedDateField name="ate" defaultIso={filters.ate} maxIso={today} /></div>
      <div className="field col-span-4"><label className="text-xs font-semibold text-muted-foreground">Setor</label><Select name="setor" defaultValue={filters.setor ?? ""}><option value="">Todos</option>{sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
      <Button type="submit" className="col-span-2"><CalendarDays className="size-4" />Aplicar</Button>
    </form></CardContent></Card>

    {error && <Card className="border-red-200 bg-red-50"><CardContent className="pt-5 text-sm text-red-700">Não foi possível carregar os indicadores: {error}</CardContent></Card>}

    {!error && empty && <Card className="border-dashed"><CardContent className="grid place-items-center gap-2 py-14 text-center text-sm text-muted-foreground"><Activity className="size-8 text-muted-foreground/60" /><p className="font-medium text-foreground">Nenhuma avaliação de {info.short} no período.</p><p>Ajuste o período ou o setor. As avaliações aparecem aqui assim que são registradas em Escalas clínicas.</p></CardContent></Card>}

    {k && !empty && <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi icon={UsersRound} label="Pacientes avaliados" value={fmt(k.pacientes)} hint={`${fmt(k.entradas)} entradas · ${fmt(k.saidas)} saídas`} />
        <Kpi icon={ArrowUpRight} label="Pacientes que melhoraram" value={fmt(k.melhoraram)} hint={`${fmt(k.mantiveram)} mantiveram · ${fmt(k.pioraram)} pioraram`} tone="good" />
        <Kpi icon={TrendingUp} label="Taxa de melhora" value={pct(improvementRate)} hint={`${fmt(k.melhoraram)} de ${fmt(k.pares)} saídas com entrada`} tone={improvementRate !== null && improvementRate >= 50 ? "good" : undefined} />
        <Kpi icon={Activity} label="Ganho médio" value={fmt(k.ganho_medio, " pts")} hint={`Entrada ${fmt(k.media_entrada)} → saída ${fmt(k.media_saida)} (de ${info.max})`} tone={(toNumber(k.ganho_medio) ?? 0) > 0 ? "good" : (toNumber(k.ganho_medio) ?? 0) < 0 ? "bad" : undefined} />
        <Kpi icon={Clock3} label="Tempo médio entre avaliações" value={fmt(k.permanencia_media, " dias")} hint={k.incompletas ? `${fmt(k.incompletas)} avaliações incompletas fora do cálculo` : "Da entrada até a saída"} />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Volume e melhoras por mês</CardTitle><CardDescription>Entradas, saídas e quantidade de pacientes que melhoraram; a linha mostra a taxa de melhora.</CardDescription></CardHeader>
          <CardContent><div className="h-[300px] w-full"><ResponsiveContainer><ComposedChart data={monthly} margin={{ left: -12, right: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="n" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="p" orientation="right" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v, name) => (String(name).includes("%") ? `${ptBRNumber.format(Number(v))}%` : ptBRNumber.format(Number(v)))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="n" dataKey="Entradas" fill={ENTRY} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar yAxisId="n" dataKey="Saídas" fill={EXIT} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar yAxisId="n" dataKey="Melhoraram" fill={GOOD} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Line yAxisId="p" type="monotone" dataKey="Taxa de melhora (%)" stroke={GOOD} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
          </ComposedChart></ResponsiveContainer></div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Desfecho das saídas</CardTitle><CardDescription>Comparação da saída com a entrada do mesmo paciente e atendimento.</CardDescription></CardHeader>
          <CardContent className="grid gap-4">
            <Outcome label="Melhoraram" n={k.melhoraram} total={k.pares} color={GOOD} icon={ArrowUpRight} />
            <Outcome label="Mantiveram" n={k.mantiveram} total={k.pares} color={ENTRY} icon={Minus} />
            <Outcome label="Pioraram" n={k.pioraram} total={k.pares} color={BAD} icon={ArrowDownRight} />
            <p className="text-xs text-muted-foreground">{fmt(k.saidas - k.pares)} saídas sem entrada correspondente completa não entram na comparação.{scale === "barthel" && k.mantiveram > 0 ? " Quem entra independente (100) não tem como subir: aparece em “mantiveram”." : ""}{worseRate !== null && worseRate >= 15 ? ` Atenção: ${pct(worseRate)} pioraram.` : ""}</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Pontuação média por mês</CardTitle><CardDescription>Média do total na entrada e na saída (máximo {info.max}).</CardDescription></CardHeader>
          <CardContent><div className="h-[260px] w-full"><ResponsiveContainer><LineChart data={monthly} margin={{ left: -12, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis domain={[0, info.max]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v) => ptBRNumber.format(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="Média na entrada" stroke={ENTRY} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
            <Line type="monotone" dataKey="Média na saída" stroke={EXIT} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
          </LineChart></ResponsiveContainer></div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Distribuição por faixa</CardTitle><CardDescription>{info.bandsNote}</CardDescription></CardHeader>
          <CardContent className="grid gap-3">
            {distribution.map((d) => <div key={d.faixa} className="grid gap-1.5">
              <div className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 font-medium"><span className="size-2.5 rounded-full" style={{ background: d.color }} />{d.faixa}</span><span className="text-xs text-muted-foreground">entrada {pct(d.entradaPct)} · saída {pct(d.saidaPct)}</span></div>
              <Meter value={d.entradaPct} color={ENTRY} label={`Entrada: ${d.entrada}`} />
              <Meter value={d.saidaPct} color={EXIT} label={`Saída: ${d.saida}`} />
            </div>)}
            <div className="flex gap-4 pt-1 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded" style={{ background: ENTRY }} />Entrada</span><span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded" style={{ background: EXIT }} />Saída</span></div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Melhoras mês a mês</CardTitle><CardDescription>Quantidade de pacientes que melhoraram entre as saídas comparadas com a entrada.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[640px] text-sm">
          <thead className="border-y bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3 text-left">Mês</th><th className="px-3 py-3 text-right">Saídas</th><th className="px-3 py-3 text-right">Saídas comparadas</th><th className="px-3 py-3 text-right">Melhoraram</th><th className="px-3 py-3 text-right">Taxa de melhora</th><th className="px-5 py-3 text-right">Ganho médio</th></tr></thead>
          <tbody className="divide-y">{data!.mensal.map((m) => { const r = rate(m.melhoraram, m.pares); return <tr key={m.mes}><td className="px-5 py-2.5 font-medium">{monthShort(m.mes)}</td><td className="px-3 py-2.5 text-right tabular-nums">{fmt(m.saidas)}</td><td className="px-3 py-2.5 text-right tabular-nums">{fmt(m.pares)}</td><td className="px-3 py-2.5 text-right font-semibold tabular-nums" style={{ color: GOOD }}>{fmt(m.melhoraram)}</td><td className="px-3 py-2.5 text-right tabular-nums">{pct(r)}</td><td className="px-5 py-2.5 text-right tabular-nums">{fmt(m.ganho_medio, " pts")}</td></tr>; })}</tbody>
          <tfoot className="border-t bg-muted/30 font-semibold"><tr><td className="px-5 py-3">Total</td><td className="px-3 py-3 text-right tabular-nums">{fmt(k.saidas)}</td><td className="px-3 py-3 text-right tabular-nums">{fmt(k.pares)}</td><td className="px-3 py-3 text-right tabular-nums" style={{ color: GOOD }}>{fmt(k.melhoraram)}</td><td className="px-3 py-3 text-right tabular-nums">{pct(improvementRate)}</td><td className="px-5 py-3 text-right tabular-nums">{fmt(k.ganho_medio, " pts")}</td></tr></tfoot>
        </table></CardContent>
      </Card>

      {transitions && transitions.total > 0 && <Card>
        <CardHeader><CardTitle>Mudança de faixa entre entrada e saída</CardTitle><CardDescription>{fmt(transitions.up)} pacientes subiram de faixa ({pct(rate(transitions.up, transitions.total))}), {fmt(transitions.same)} ficaram na mesma ({pct(rate(transitions.same, transitions.total))}) e {fmt(transitions.down)} desceram ({pct(rate(transitions.down, transitions.total))}).</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto"><table className="w-full min-w-[560px] border-separate border-spacing-1 text-center text-sm">
          <thead><tr><th className="p-2 text-left text-xs font-semibold text-muted-foreground">Entrada ↓ / Saída →</th>{SCALE_BANDS[scale].map((b) => <th key={b.label} className="p-2 text-xs font-semibold text-muted-foreground">{b.label}</th>)}</tr></thead>
          <tbody>{transitions.matrix.map((row, i) => { const rowMax = Math.max(...transitions.matrix.flat(), 1); return <tr key={i}><th className="p-2 text-left text-xs font-semibold">{SCALE_BANDS[scale][i].label}</th>{row.map((n, j) => { const tone = j > i ? GOOD : j < i ? BAD : EXIT; return <td key={j} className={cn("rounded-lg p-2 tabular-nums", n ? "font-semibold" : "text-muted-foreground")} style={{ background: n ? `${tone}${Math.round(18 + (n / rowMax) * 60).toString(16).padStart(2, "0")}` : "#f6f8f7" }}>{n || "·"}</td>; })}</tr>; })}</tbody>
        </table><p className="mt-2 text-xs text-muted-foreground">Verde: subiu de faixa · azul: manteve · vermelho: desceu.</p></CardContent>
      </Card>}

      <Card>
        <CardHeader><CardTitle>Desempenho por item</CardTitle><CardDescription>Média de cada item em % da pontuação máxima, na entrada e na saída. Mostra onde está o maior ganho funcional.</CardDescription></CardHeader>
        <CardContent><div className="w-full" style={{ height: Math.max(220, items.length * 40) }}><ResponsiveContainer><BarChart data={items} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID} />
          <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="item" width={170} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(v, name, p) => { const row = p.payload as (typeof items)[number]; const pts = name === "Entrada" ? row.entradaPts : row.saidaPts; return [`${ptBRNumber.format(Number(v))}% (${pts === null ? "—" : ptBRNumber.format(pts)} de ${row.max} pts)`, name]; }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Entrada" fill={ENTRY} radius={[0, 4, 4, 0]} maxBarSize={14} />
          <Bar dataKey="Saída" fill={EXIT} radius={[0, 4, 4, 0]} maxBarSize={14} />
        </BarChart></ResponsiveContainer></div></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Por setor</CardTitle><CardDescription>Volume, médias e melhora em cada setor no período.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[920px] text-sm">
          <thead className="border-y bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3 text-left">Setor</th><th className="px-3 py-3 text-right">Entradas</th><th className="px-3 py-3 text-right">Saídas</th><th className="px-3 py-3 text-right">Média entrada</th><th className="px-3 py-3 text-right">Média saída</th><th className="px-3 py-3 text-right">Ganho médio</th><th className="px-3 py-3 text-right">Melhoraram</th><th className="px-3 py-3 text-right">Taxa de melhora</th><th className="px-5 py-3 text-right">Dias entre avaliações</th></tr></thead>
          <tbody className="divide-y">{data!.setores.map((s) => { const r = rate(s.melhoraram, s.pares); return <tr key={s.setor}><td className="px-5 py-3 font-medium">{s.setor}</td><td className="px-3 py-3 text-right tabular-nums">{fmt(s.entradas)}</td><td className="px-3 py-3 text-right tabular-nums">{fmt(s.saidas)}</td><td className="px-3 py-3 text-right tabular-nums">{fmt(s.media_entrada)}</td><td className="px-3 py-3 text-right tabular-nums">{fmt(s.media_saida)}</td><td className="px-3 py-3 text-right tabular-nums">{fmt(s.ganho_medio)}</td><td className="px-3 py-3 text-right font-semibold tabular-nums">{fmt(s.melhoraram)} <span className="font-normal text-muted-foreground">/ {fmt(s.pares)}</span></td><td className="px-3 py-3 text-right"><span className="inline-flex min-w-16 justify-end font-semibold tabular-nums" style={{ color: r === null ? undefined : r >= 50 ? GOOD : r < 30 ? BAD : undefined }}>{pct(r)}</span></td><td className="px-5 py-3 text-right tabular-nums">{fmt(s.permanencia_media)}</td></tr>; })}</tbody>
        </table></CardContent>
      </Card>

      {data!.colaboradores.some((c) => c.nome !== "Não informado") && <Card>
        <CardHeader><CardTitle>Avaliações por profissional</CardTitle><CardDescription>Os 20 profissionais com mais avaliações completas no período.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[520px] text-sm">
          <thead className="border-y bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3 text-left">Profissional</th><th className="px-3 py-3 text-right">Entradas</th><th className="px-3 py-3 text-right">Saídas</th><th className="px-5 py-3 text-right">Total</th></tr></thead>
          <tbody className="divide-y">{data!.colaboradores.map((c) => <tr key={c.nome}><td className="px-5 py-2.5">{c.nome}</td><td className="px-3 py-2.5 text-right tabular-nums">{fmt(c.entradas)}</td><td className="px-3 py-2.5 text-right tabular-nums">{fmt(c.saidas)}</td><td className="px-5 py-2.5 text-right font-semibold tabular-nums">{fmt(c.avaliacoes)}</td></tr>)}</tbody>
        </table></CardContent>
      </Card>}
    </>}

    {quality && !error && <ScaleQualitySection key={`${scale}-${filters.de}-${filters.ate}-${filters.setor ?? ""}`} scale={scale} data={quality} sectors={sectors} collaborators={collaborators} today={today} unitName={unitName} period={{ de: filters.de, ate: filters.ate }} />}
  </div>;
}

function Kpi({ icon: Icon, label, value, hint, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint: string; tone?: "good" | "bad" }) {
  return <Card><CardContent className="grid gap-2 pt-5 md:pt-6">
    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span>{label}</span><Icon className="size-4" /></div>
    <p className={cn("font-display text-2xl font-bold tracking-tight tabular-nums md:text-3xl", tone === "good" && "text-emerald-700", tone === "bad" && "text-red-700")}>{value}</p>
    <p className="text-xs leading-snug text-muted-foreground">{hint}</p>
  </CardContent></Card>;
}

function Outcome({ label, n, total, color, icon: Icon }: { label: string; n: number; total: number; color: string; icon: React.ComponentType<{ className?: string }> }) {
  const p = rate(n, total);
  return <div className="grid gap-1.5">
    <div className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 font-medium"><Icon className="size-4" />{label}</span><span className="tabular-nums"><b>{ptBRNumber.format(n)}</b> <span className="text-muted-foreground">({pct(p)})</span></span></div>
    <Meter value={p ?? 0} color={color} label={label} />
  </div>;
}

function Meter({ value, color, label }: { value: number; color: string; label: string }) {
  return <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} /></div>;
}

function ExportButton({ scale, data, filters, unitName, sectorName }: { scale: ScaleType; data: ScaleBi; filters: Filters; unitName: string; sectorName: string }) {
  const [busy, setBusy] = useState(false);
  async function exportXlsx() {
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const info = SCALE_INFO[scale];
      const k = data.kpis;
      const br = (d: string) => d.split("-").reverse().join("/");
      const n = (v: number | string | null) => toNumber(v);
      const resumo = [
        [`B.I. — ${info.name}`], [`Unidade: ${unitName}`], [`Setor: ${sectorName}`], [`Período: ${br(filters.de)} a ${br(filters.ate)}`], [],
        ["Indicador", "Valor"],
        ["Avaliações registradas", k.avaliacoes], ["Avaliações incompletas", k.incompletas], ["Pacientes avaliados", k.pacientes],
        ["Entradas (completas)", k.entradas], ["Saídas (completas)", k.saidas], ["Saídas com entrada correspondente", k.pares],
        ["Pacientes que melhoraram", k.melhoraram], ["Mantiveram", k.mantiveram], ["Pioraram", k.pioraram],
        ["Taxa de melhora (%)", rate(k.melhoraram, k.pares)], ["Média na entrada", n(k.media_entrada)], ["Média na saída", n(k.media_saida)],
        ["Ganho médio (pts)", n(k.ganho_medio)], ["Dias médios entre entrada e saída", n(k.permanencia_media)],
      ];
      const sheet = (rows: unknown[][], widths: number[]) => { const ws = XLSX.utils.aoa_to_sheet(rows); ws["!cols"] = widths.map((wch) => ({ wch })); return ws; };
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet(resumo, [38, 14]), "Resumo");
      const mensal = XLSX.utils.aoa_to_sheet([["Mês", "Entradas", "Saídas", "Média entrada", "Média saída", "Saídas comparadas", "Melhoraram", "Taxa de melhora (%)", "Ganho médio"], ...data.mensal.map((m) => [monthShort(m.mes), m.entradas, m.saidas, n(m.media_entrada), n(m.media_saida), m.pares, m.melhoraram, rate(m.melhoraram, m.pares), n(m.ganho_medio)])]);
      mensal["!cols"] = [10, 10, 10, 14, 13, 18, 12, 18, 12].map((wch) => ({ wch }));
      XLSX.utils.book_append_sheet(wb, mensal, "Por mês");
      XLSX.utils.book_append_sheet(wb, sheet([["Setor", "Entradas", "Saídas", "Média entrada", "Média saída", "Saídas comparadas", "Melhoraram", "Taxa de melhora (%)", "Ganho médio", "Dias entre avaliações"], ...data.setores.map((s) => [s.setor, s.entradas, s.saidas, n(s.media_entrada), n(s.media_saida), s.pares, s.melhoraram, rate(s.melhoraram, s.pares), n(s.ganho_medio), n(s.permanencia_media)])], [24, 10, 10, 14, 13, 18, 12, 18, 12, 20]), "Por setor");
      XLSX.utils.book_append_sheet(wb, sheet([["Item", "Pontuação máxima", "Média entrada", "Média saída"], ...data.itens.map((i) => [i.item, i.max, n(i.media_entrada), n(i.media_saida)])], [34, 16, 14, 13]), "Por item");
      XLSX.utils.book_append_sheet(wb, sheet([["Faixa", "Entradas", "% entradas", "Saídas", "% saídas"], ...bandDistribution(scale, data.histograma).map((d) => [d.faixa, d.entrada, d.entradaPct, d.saida, d.saidaPct])], [30, 10, 12, 10, 10]), "Faixas");
      XLSX.utils.book_append_sheet(wb, sheet([["Profissional", "Entradas", "Saídas", "Total"], ...data.colaboradores.map((c) => [c.nome, c.entradas, c.saidas, c.avaliacoes])], [34, 10, 10, 10]), "Profissionais");
      const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
      XLSX.writeFile(wb, `maisfisio-bi-${scale}-${filters.de}-a-${filters.ate}-${slug(unitName)}.xlsx`);
    } catch (e) {
      toast.error(`Não foi possível gerar o Excel: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }
  return <Button variant="outline" onClick={exportXlsx} disabled={busy}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}Exportar Excel</Button>;
}
