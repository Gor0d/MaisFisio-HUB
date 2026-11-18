"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Maximize2, Minimize2, Minus, Printer, Table2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Grouped } from "@/components/dashboard-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KPI_LABELS, SERVICE_KPIS, THEMES } from "@/lib/service-themes";
import { effectiveTarget, targetSituation, type IndicatorTarget } from "@/lib/targets";
import { ptBRNumber } from "@/lib/utils";

type Service = { id: string; code: string; name: string };
type Indicator = { id: string; code: string; name: string; kind: string; derived: boolean; context: string };

const CONTEXT_LABELS: Record<string, string> = { geral: "Atendimento geral", uti: "UTI", enfermaria: "Enfermaria", ambulatorio: "Ambulatório" };
const monthShort = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" });
const monthLong = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const asDate = (month: string) => new Date(`${month}-01T00:00:00Z`);
const shortLabel = (month: string) => monthShort.format(asDate(month)).replace(". de ", "/").replace(".", "");
const shiftMonth = (month: string, delta: number) => {
  const date = asDate(month); date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
};
const formatValue = (value: number | null, kind: string) => value === null ? "—" : kind === "taxa" ? `${ptBRNumber.format(value)}%` : ptBRNumber.format(value);

export function MonthlyPanel({ services, service, unitName, activeUnitId, month, months, rows, indicators, targets }: { services: Service[]; service: Service | null; unitName: string; activeUnitId: string | null; month: string; months: string[]; rows: Grouped[]; indicators: Indicator[]; targets: IndicatorTarget[] }) {
  const theme = THEMES[service?.code ?? ""] ?? THEMES.fisioterapia;
  const rootRef = useRef<HTMLDivElement>(null);
  const [presenting, setPresenting] = useState(false);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const sync = () => setPresenting(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const togglePresentation = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await rootRef.current?.requestFullscreen?.().catch(() => setPresenting((value) => !value));
  };

  // indicador → mês → valor agregado (contagem: soma; taxa: média; derivada: razão).
  const series = useMemo(() => {
    const byIndicator = new Map<string, Map<string, number | null>>();
    rows.forEach((row) => {
      const map = byIndicator.get(row.indicator_id) ?? new Map<string, number | null>();
      map.set(row.bucket, row.total === null ? null : Number(row.total));
      byIndicator.set(row.indicator_id, map);
    });
    return byIndicator;
  }, [rows]);
  const valueOf = (indicatorId: string, m: string) => series.get(indicatorId)?.get(m) ?? null;
  const withData = indicators.filter((indicator) => months.some((m) => valueOf(indicator.id, m) !== null));
  const highlights = (SERVICE_KPIS[service?.code ?? ""] ?? []).map((code) => indicators.find((i) => i.code === code)).filter((i): i is Indicator => Boolean(i));
  const contexts = [...new Set(withData.map((i) => i.context))];
  const previous = shiftMonth(month, -1);
  const href = (params: { servico?: string; mes?: string }) => `/painel-mensal?${new URLSearchParams({ servico: params.servico ?? service?.id ?? "", mes: params.mes ?? month }).toString()}`;

  const summary = (indicator: Indicator) => {
    const current = valueOf(indicator.id, month);
    const prior = valueOf(indicator.id, previous);
    const delta = current !== null && prior ? ((current - prior) / prior) * 100 : null;
    const situation = current === null ? null : targetSituation(current, effectiveTarget(targets, indicator.id, activeUnitId, null));
    return { current, prior, delta, situation };
  };

  return (
    <div ref={rootRef} className={presenting ? "fixed inset-0 z-50 overflow-y-auto bg-background p-6 md:p-10" : "grid gap-6"}>
      <div className={presenting ? "mx-auto grid max-w-[1400px] gap-8" : "contents"}>
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Painel mensal · {unitName}</p>
            <h1 className={`page-title ${presenting ? "!text-4xl" : ""}`}>{service?.name ?? "Indicadores"} <span className="font-normal text-muted-foreground">— {monthLong.format(asDate(month))}</span></h1>
            <p className="page-description">Mês de referência em destaque, comparado ao mês anterior, com os 12 meses para contexto.</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="outline" onClick={() => setShowTable((v) => !v)}><Table2 className="size-4" />{showTable ? "Ocultar tabela" : "Ver tabela"}</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="size-4" />Imprimir / PDF</Button>
            <Button onClick={togglePresentation} style={{ background: theme.accent }}>{presenting ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}{presenting ? "Sair da apresentação" : "Modo apresentação"}</Button>
          </div>
        </header>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between print:hidden">
          <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Especialidades">
            {services.map((s) => { const t = THEMES[s.code]; const active = s.id === service?.id; return (
              <Link key={s.id} href={href({ servico: s.id })} className={`flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${active ? "border-transparent text-white" : "bg-card hover:bg-muted"}`} style={active ? { background: t?.accent } : undefined}>
                {!active && <span className="size-2.5 rounded-full" style={{ background: t?.accent }} aria-hidden />}{s.name}
              </Link>
            ); })}
          </nav>
          <div className="flex items-center gap-1 self-start rounded-full border bg-card p-1 md:self-auto">
            <Link href={href({ mes: previous })} aria-label="Mês anterior" className="grid size-8 place-items-center rounded-full hover:bg-muted"><ChevronLeft className="size-4" /></Link>
            <form action="/painel-mensal" className="flex items-center">
              <input type="hidden" name="servico" value={service?.id ?? ""} />
              <input type="month" name="mes" defaultValue={month} aria-label="Mês de referência" onChange={(e) => e.currentTarget.form?.requestSubmit()} className="h-8 rounded-md bg-transparent px-2 text-sm font-medium outline-none" />
            </form>
            <Link href={href({ mes: shiftMonth(month, 1) })} aria-label="Próximo mês" className="grid size-8 place-items-center rounded-full hover:bg-muted"><ChevronRight className="size-4" /></Link>
          </div>
        </div>

        {!withData.length ? (
          <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Não há lançamentos deste serviço nos 12 meses até {monthLong.format(asDate(month))}.</CardContent></Card>
        ) : (
          <>
            {highlights.length > 0 && (
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Destaques do mês">
                {highlights.map((indicator) => <HighlightTile key={indicator.id} indicator={indicator} label={KPI_LABELS[indicator.code] ?? indicator.name} summary={summary(indicator)} points={months.map((m) => ({ month: m, label: shortLabel(m), value: valueOf(indicator.id, m) }))} accent={theme.accent} soft={theme.soft} large={presenting} />)}
              </section>
            )}

            {showTable && <MonthTable indicators={withData} months={months} month={month} valueOf={valueOf} accentSoft={theme.soft} />}

            {contexts.map((context) => (
              <section key={context} className="grid gap-4">
                {contexts.length > 1 && <h2 className="font-display text-lg font-bold tracking-tight">{CONTEXT_LABELS[context] ?? context}</h2>}
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {withData.filter((i) => i.context === context).map((indicator) => <IndicatorCard key={indicator.id} indicator={indicator} summary={summary(indicator)} points={months.map((m) => ({ month: m, label: shortLabel(m), value: valueOf(indicator.id, m) }))} month={month} accent={theme.accent} />)}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

type Summary = { current: number | null; prior: number | null; delta: number | null; situation: ReturnType<typeof targetSituation> };
type Point = { month: string; label: string; value: number | null };

function Delta({ delta }: { delta: number | null }) {
  const Arrow = delta === null ? Minus : delta >= 0 ? ArrowUpRight : ArrowDownRight;
  return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Arrow className="size-3.5" />{delta === null ? "sem mês anterior" : `${delta >= 0 ? "+" : ""}${ptBRNumber.format(delta)}% vs mês anterior`}</span>;
}

function TargetBadge({ situation, kind }: { situation: Summary["situation"]; kind: string }) {
  if (!situation) return null;
  const goal = `${situation.target.comparison === "maximo" ? "≤" : "≥"} ${formatValue(Number(situation.target.target_value), kind)}`;
  return <Badge className={situation.achieved ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>{situation.achieved ? "✓ Meta atingida" : "✗ Meta não atingida"} · {goal}</Badge>;
}

function ChartTooltip({ active, payload, kind }: { active?: boolean; payload?: { payload: Point }[]; kind: string }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-md"><p className="font-medium">{monthLong.format(asDate(point.month))}</p><p className="mt-0.5 tabular-nums text-muted-foreground">{point.value === null ? "Sem lançamento" : formatValue(point.value, kind)}</p></div>;
}

function HighlightTile({ indicator, label, summary, points, accent, soft, large }: { indicator: Indicator; label: string; summary: Summary; points: Point[]; accent: string; soft: string; large: boolean }) {
  return <Card className="overflow-hidden border-t-4" style={{ borderTopColor: accent }}><CardContent className="pt-5 md:pt-6">
    <p className="truncate text-sm text-muted-foreground" title={indicator.name}>{label}</p>
    <p className={`mt-1 font-display font-bold tracking-tight tabular-nums ${large ? "text-5xl" : "text-3xl"}`}>{formatValue(summary.current, indicator.kind)}</p>
    <div className="mt-1"><Delta delta={summary.delta} /></div>
    <div className="mt-3 h-14" aria-hidden>
      <ResponsiveContainer><LineChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
        <Tooltip content={<ChartTooltip kind={indicator.kind} />} cursor={{ stroke: soft, strokeWidth: 2 }} />
        <Line type="monotone" dataKey="value" stroke={accent} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} connectNulls={false} isAnimationActive={false} />
      </LineChart></ResponsiveContainer>
    </div>
    {summary.situation && <div className="mt-3 border-t pt-3"><TargetBadge situation={summary.situation} kind={indicator.kind} /></div>}
  </CardContent></Card>;
}

function IndicatorCard({ indicator, summary, points, month, accent }: { indicator: Indicator; summary: Summary; points: Point[]; month: string; accent: string }) {
  return <Card className="break-inside-avoid"><CardHeader className="pb-2">
    <CardTitle className="text-sm font-semibold leading-snug">{indicator.name}</CardTitle>
    <CardDescription className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="font-display text-2xl font-bold tabular-nums text-foreground">{formatValue(summary.current, indicator.kind)}</span><Delta delta={summary.delta} /></CardDescription>
  </CardHeader><CardContent>
    <div className="h-36" role="img" aria-label={`${indicator.name}: ${points.map((p) => `${p.label} ${formatValue(p.value, indicator.kind)}`).join(", ")}`}>
      <ResponsiveContainer><BarChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap="28%">
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} interval={1} />
        <YAxis hide domain={[0, "auto"]} />
        <Tooltip content={<ChartTooltip kind={indicator.kind} />} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {points.map((p) => <Cell key={p.month} fill={accent} fillOpacity={p.month === month ? 1 : 0.35} />)}
        </Bar>
      </BarChart></ResponsiveContainer>
    </div>
    {summary.situation && <div className="mt-2"><TargetBadge situation={summary.situation} kind={indicator.kind} /></div>}
  </CardContent></Card>;
}

function MonthTable({ indicators, months, month, valueOf, accentSoft }: { indicators: Indicator[]; months: string[]; month: string; valueOf: (id: string, m: string) => number | null; accentSoft: string }) {
  return <Card><CardHeader><CardTitle>Tabela mensal</CardTitle><CardDescription>Valores por mês; o mês de referência está destacado.</CardDescription></CardHeader><CardContent className="overflow-x-auto p-0">
    <table className="w-full min-w-[960px] text-sm">
      <thead><tr className="border-b text-xs text-muted-foreground"><th className="sticky left-0 bg-card px-4 py-2 text-left font-semibold">Indicador</th>{months.map((m) => <th key={m} className="px-2 py-2 text-right font-semibold" style={m === month ? { background: accentSoft } : undefined}>{shortLabel(m)}</th>)}</tr></thead>
      <tbody>{indicators.map((indicator) => <tr key={indicator.id} className="border-b last:border-0"><td className="sticky left-0 max-w-[280px] truncate bg-card px-4 py-2" title={indicator.name}>{indicator.name}</td>{months.map((m) => <td key={m} className="px-2 py-2 text-right tabular-nums" style={m === month ? { background: accentSoft, fontWeight: 600 } : undefined}>{formatValue(valueOf(indicator.id, m), indicator.kind)}</td>)}</tr>)}</tbody>
    </table>
  </CardContent></Card>;
}
