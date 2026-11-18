"use client";

import { Download, FileSpreadsheet, Loader2, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { buildMonthlyReport, contextLabel, formatDelta, formatTarget, formatValue, type ReportCatalogItem, type ReportScaleRow, type ReportTotal } from "@/lib/report-model";
import type { IndicatorTarget } from "@/lib/targets";
import { ptBRNumber } from "@/lib/utils";

const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function ReportsView({ month, unitName, activeUnitId, totals, previousTotals, catalog, scales, targets }: { month: string; unitName: string; activeUnitId: string | null; totals: ReportTotal[]; previousTotals: ReportTotal[]; catalog: ReportCatalogItem[]; scales: ReportScaleRow[]; targets: IndicatorTarget[] }) {
  const [competencia, setCompetencia] = useState(month);
  const [busy, setBusy] = useState<"pdf" | "xlsx" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const years = Array.from({ length: new Date().getFullYear() - 2022 }, (_, i) => String(2023 + i));
  // Totais já vêm agregados corretamente do banco (soma para contagem, média
  // para taxa digitada, soma(numerador)/soma(denominador) para taxa derivada).
  const report = useMemo(() => buildMonthlyReport({ month, unitName, activeUnitId, totals, previousTotals, catalog, targets, scales }), [month, unitName, activeUnitId, totals, previousTotals, catalog, targets, scales]);

  async function download(kind: "pdf" | "xlsx") {
    setBusy(kind); setError(null);
    try {
      const { exportReportPdf, exportReportXlsx } = await import("@/lib/report-export");
      await (kind === "pdf" ? exportReportPdf(report) : exportReportXlsx(report));
    } catch (e) {
      console.error(e); setError("Não foi possível gerar o arquivo. Tente novamente.");
    } finally {
      setBusy(null);
    }
  }

  const s = report.summary;
  const cards = [
    { label: "Indicadores com registro", value: ptBRNumber.format(s.indicators) },
    { label: "Metas atingidas", value: s.targetsTotal ? `${s.targetsAchieved} de ${s.targetsTotal}` : "Sem metas" },
    { label: "Avaliações clínicas", value: ptBRNumber.format(s.assessments) },
    { label: "Saídas com melhora", value: s.improvementRate === null ? "—" : `${ptBRNumber.format(s.improvementRate)}%` },
  ];

  return (
    <div className="grid gap-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="page-title">Relatórios mensais</h1>
          <p className="page-description">Consolidado de {unitName} em {report.monthLabel}, comparado a {report.previousMonthLabel}.</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer className="size-4" />Imprimir</Button>
          <Button variant="outline" onClick={() => download("xlsx")} disabled={busy !== null || !s.indicators}>{busy === "xlsx" ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}Exportar Excel</Button>
          <Button onClick={() => download("pdf")} disabled={busy !== null || !s.indicators}>{busy === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}Gerar PDF</Button>
        </div>
      </header>
      {error && <p className="no-print rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <Card className="no-print">
        <CardContent className="pt-5 md:pt-6">
          <form className="flex flex-col items-end gap-3 sm:flex-row">
            <div className="field w-full sm:max-w-xs">
              <label className="text-sm font-medium">Competência</label>
              <div className="flex gap-2">
                <Select value={competencia.slice(5, 7)} onChange={(e) => setCompetencia(`${competencia.slice(0, 4)}-${e.target.value}`)}>{monthNames.map((name, i) => <option key={name} value={String(i + 1).padStart(2, "0")}>{name}</option>)}</Select>
                <Select value={competencia.slice(0, 4)} onChange={(e) => setCompetencia(`${e.target.value}${competencia.slice(4)}`)}>{years.map((y) => <option key={y}>{y}</option>)}</Select>
              </div>
              <input type="hidden" name="mes" value={competencia} />
            </div>
            <Button type="submit">Carregar relatório</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="print-card">
            <CardContent className="pt-5 md:pt-6">
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="mt-2 font-display text-3xl font-semibold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {report.services.map((service) => (
        <Card key={service.code} className="print-card overflow-hidden">
          <div className="h-1.5" style={{ background: service.accent }} />
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: service.accent }} />{service.name}</CardTitle>
            <CardDescription>{service.rows.length} indicadores com registro · em negrito, os principais do serviço</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-y bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-2.5 font-medium md:px-6">Indicador</th>
                    <th className="px-3 py-2.5 text-right font-medium">{report.monthLabel.split(" ")[0]}</th>
                    <th className="px-3 py-2.5 text-right font-medium">{report.previousMonthLabel.split(" ")[0]}</th>
                    <th className="px-3 py-2.5 text-right font-medium">Variação</th>
                    <th className="px-5 py-2.5 text-right font-medium md:px-6">Meta</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {service.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-5 py-2.5 md:px-6"><span className={r.highlight ? "font-semibold" : undefined}>{r.name}</span>{contextLabel(r.context) && <span className="ml-1.5 text-xs text-muted-foreground">({contextLabel(r.context)})</span>}</td>
                      <td className="px-3 py-2.5 text-right font-display font-semibold">{formatValue(r, r.value)}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{formatValue(r, r.previous)}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{formatDelta(r)}</td>
                      <td className="px-5 py-2.5 text-right md:px-6">{r.achieved === null ? <span className="text-muted-foreground">—</span> : <span className="inline-flex items-center gap-1.5"><span className="text-xs text-muted-foreground">{formatTarget(r)}</span><Badge className={r.achieved ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>{r.achieved ? "Atingida" : "Não atingida"}</Badge></span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
      {!report.services.length && <Card><CardContent className="p-6 text-sm text-muted-foreground">Sem produção registrada em {report.monthLabel}.</CardContent></Card>}

      <Card className="print-card h-fit">
        <CardHeader><CardTitle>Escalas clínicas</CardTitle><CardDescription>Evolução entre a avaliação de entrada e a de saída.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {report.scales.map((x) => (
            <div key={x.name} className="rounded-xl bg-muted/60 p-4">
              <div className="flex justify-between"><strong>{x.name}</strong><strong className="text-primary">{x.rate === null ? "—" : `${ptBRNumber.format(x.rate)}%`}</strong></div>
              <p className="mt-1 text-xs text-muted-foreground">{x.assessments} avaliações · {x.improved} de {x.exits} saídas com melhora</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
