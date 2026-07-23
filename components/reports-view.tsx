"use client";

import { Download, Printer } from "lucide-react";
import { jsPDF } from "jspdf";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { ptBRNumber } from "@/lib/utils";

type Total = { indicator_code: string; indicator_name: string; kind: string; derived: boolean; total: number | string | null };
type ScaleRow = { scale_type: string; moment: string; total: number; improved: boolean | null };
const scaleNames: Record<string, string> = { barthel: "Barthel", mrc: "MRC", melhoria_uti: "Melhoria UTI" };
const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function ReportsView({ month, totals, scales }: { month: string; totals: Total[]; scales: ScaleRow[] }) {
  const [competencia, setCompetencia] = useState(month);
  const years = Array.from({ length: new Date().getFullYear() - 2022 }, (_, i) => String(2023 + i));
  // Totais já vêm agregados corretamente do banco (soma para contagem, média
  // para taxa digitada, soma(numerador)/soma(denominador) para taxa derivada)
  // — nunca soma de percentuais, que dava números sem sentido tipo "2700%".
  const rows = totals.filter((t) => t.total != null).map((t) => ({ ...t, total: Number(t.total) })).sort((a, b) => b.total - a.total);
  const scaleRows = Object.keys(scaleNames).map((type) => { const exits = scales.filter((x) => x.scale_type === type && x.moment === "saida" && x.improved !== null); const improved = exits.filter((x) => x.improved).length; return { name: scaleNames[type], assessments: scales.filter((x) => x.scale_type === type).length, exits: exits.length, improved, rate: exits.length ? improved / exits.length * 100 : 0 }; });
  function pdf() {
    const doc = new jsPDF(); doc.setFontSize(18); doc.text("MaisFisio — Relatório mensal", 16, 20); doc.setFontSize(11); doc.text(`Competência: ${month.split("-").reverse().join("/")}`, 16, 29);
    let y = 42; doc.setFontSize(13); doc.text("Produção assistencial", 16, y); y += 8; doc.setFontSize(9);
    // Sem limite de linhas: cada indicador ativo aparece, a paginação do PDF
    // (if y > 275) já cuida de indicadores demais para uma página só.
    rows.forEach((r) => { doc.text(r.indicator_name.slice(0, 78), 16, y); doc.text(r.kind === "taxa" ? `${ptBRNumber.format(r.total)}%` : ptBRNumber.format(r.total), 190, y, { align: "right" }); y += 6; if (y > 275) { doc.addPage(); y = 20; } });
    y += 7; doc.setFontSize(13); doc.text("Escalas clínicas", 16, y); y += 8; doc.setFontSize(9);
    scaleRows.forEach((x) => { doc.text(`${x.name}: ${x.assessments} avaliações · ${ptBRNumber.format(x.rate)}% de melhora`, 16, y); y += 6; });
    doc.save(`maisfisio-relatorio-${month}.pdf`);
  }
  return <div className="grid gap-6"><header className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><h1 className="page-title">Relatórios mensais</h1><p className="page-description">Consolidado pronto para impressão e compartilhamento.</p></div><div className="no-print flex gap-2"><Button variant="outline" onClick={() => window.print()}><Printer className="size-4" />Imprimir</Button><Button onClick={pdf}><Download className="size-4" />Gerar PDF</Button></div></header><Card className="no-print"><CardContent className="pt-5 md:pt-6"><form className="flex flex-col items-end gap-3 sm:flex-row"><div className="field w-full sm:max-w-xs"><label className="text-sm font-medium">Competência</label><div className="flex gap-2"><Select value={competencia.slice(5, 7)} onChange={(e) => setCompetencia(`${competencia.slice(0, 4)}-${e.target.value}`)}>{monthNames.map((name, i) => <option key={name} value={String(i + 1).padStart(2, "0")}>{name}</option>)}</Select><Select value={competencia.slice(0, 4)} onChange={(e) => setCompetencia(`${e.target.value}${competencia.slice(4)}`)}>{years.map((y) => <option key={y}>{y}</option>)}</Select></div><input type="hidden" name="mes" value={competencia} /></div><Button type="submit">Carregar relatório</Button></form></CardContent></Card><div className="grid gap-6 xl:grid-cols-2"><Card className="print-card"><CardHeader><CardTitle>Produção assistencial</CardTitle><CardDescription>{rows.length} indicadores com registro em {month.split("-").reverse().join("/")}</CardDescription></CardHeader><CardContent className="divide-y p-0">{rows.map((r) => <div key={r.indicator_code} className="flex items-center justify-between gap-5 px-5 py-3 md:px-6"><span className="text-sm">{r.indicator_name}</span><strong className="font-display">{r.kind === "taxa" ? `${ptBRNumber.format(r.total)}%` : ptBRNumber.format(r.total)}</strong></div>)}{!rows.length && <p className="p-6 text-sm text-muted-foreground">Sem produção no mês.</p>}</CardContent></Card><Card className="print-card h-fit"><CardHeader><CardTitle>Escalas clínicas</CardTitle><CardDescription>Evolução entre entrada e saída.</CardDescription></CardHeader><CardContent className="space-y-5">{scaleRows.map((x) => <div key={x.name} className="rounded-xl bg-muted/60 p-4"><div className="flex justify-between"><strong>{x.name}</strong><strong className="text-primary">{ptBRNumber.format(x.rate)}%</strong></div><p className="mt-1 text-xs text-muted-foreground">{x.assessments} avaliações · {x.improved} de {x.exits} saídas com melhora</p></div>)}</CardContent></Card></div></div>;
}
