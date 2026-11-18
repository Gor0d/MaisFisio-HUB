// Exportação do relatório mensal em PDF (identidade MaisFisio) e Excel.
// Só roda no navegador: as bibliotecas são carregadas sob demanda.
import { contextLabel, formatDelta, formatTarget, formatValue, situationLabel, type MonthlyReport, type ReportRow } from "@/lib/report-model";

const NAVY = "#16233a";
const PRIMARY = "#2e5080";
const MUTED = "#5b6b82";
const LINE = "#dce3ec";
const GREEN = "#047857";
const RED = "#b91c1c";

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fileBase(report: MonthlyReport) {
  const unit = report.unitName.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `maisfisio-relatorio-${report.month}-${unit || "unidade"}`;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function indicatorName(row: ReportRow) {
  const context = contextLabel(row.context);
  return context ? `${row.name} (${context})` : row.name;
}

async function imageDataUrl(path: string) {
  try {
    const blob = await (await fetch(path)).blob();
    return await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
  } catch {
    return null;
  }
}

export async function exportReportPdf(report: MonthlyReport) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const logo = await imageDataUrl("/logo-maisfisio-white.png");

  // Cabeçalho da primeira página
  doc.setFillColor(NAVY); doc.rect(0, 0, W, 42, "F");
  doc.setFillColor(PRIMARY); doc.rect(0, 42, W, 1.6, "F");
  if (logo) doc.addImage(logo, "PNG", M, 9, 36, 24);
  doc.setTextColor("#ffffff");
  doc.setFont("helvetica", "bold"); doc.setFontSize(17);
  doc.text("Relatório mensal", W - M, 17, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
  doc.text("Produção assistencial e evolução clínica", W - M, 24, { align: "right" });
  doc.setFontSize(9.5); doc.setTextColor("#c9d5e6");
  doc.text(`${report.unitName}  ·  ${capitalize(report.monthLabel)}`, W - M, 31, { align: "right" });

  doc.setTextColor(MUTED); doc.setFontSize(8.5);
  doc.text(`Comparação com ${report.previousMonthLabel}. Gerado em ${dateTime.format(report.generatedAt)} pelo MaisFisio HUB.`, M, 52);

  // Cartões de resumo
  const s = report.summary;
  const cards = [
    { label: "Indicadores com registro", value: integer.format(s.indicators) },
    s.targetsTotal
      ? { label: "Metas atingidas", value: `${s.targetsAchieved} de ${s.targetsTotal}` }
      : { label: "Serviços com produção", value: integer.format(report.services.length) },
    { label: "Avaliações clínicas", value: integer.format(s.assessments) },
    { label: "Saídas com melhora", value: s.improvementRate === null ? "—" : `${pct.format(s.improvementRate)}%` },
  ];
  const gap = 4; const cw = (W - 2 * M - gap * 3) / 4; let y = 57;
  cards.forEach((card, i) => {
    const x = M + i * (cw + gap);
    doc.setFillColor("#f3f6fa"); doc.setDrawColor(LINE); doc.roundedRect(x, y, cw, 22, 2.5, 2.5, "FD");
    doc.setFillColor(PRIMARY); doc.rect(x, y + 3, 1.2, 16, "F");
    doc.setTextColor(NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text(card.value, x + 5, y + 11);
    doc.setTextColor(MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(card.label, x + 5, y + 17.5);
  });
  y += 32;

  const ensureSpace = (needed: number) => { if (y + needed > H - 20) { doc.addPage(); y = 20; } };
  const sectionTitle = (title: string, subtitle: string, accent: string) => {
    ensureSpace(24);
    doc.setFillColor(accent); doc.roundedRect(M, y - 4.5, 2.2, 9, 1, 1, "F");
    doc.setTextColor(NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); doc.text(title, M + 5, y + 1);
    doc.setTextColor(MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.text(subtitle, W - M, y + 1, { align: "right" });
    y += 6;
  };

  const monthShort = (label: string) => { const [m, , y] = label.split(" "); return `${capitalize(m.slice(0, 3))}/${y.slice(2)}`; };

  for (const service of report.services) {
    const highlights = service.rows.filter((r) => r.highlight).length;
    sectionTitle(service.name, `${service.rows.length} indicadores${highlights ? ` · ${highlights} em destaque` : ""}`, service.accent);
    // Colunas de meta só aparecem quando o serviço tem alguma meta cadastrada.
    const withTargets = service.rows.some((r) => r.target);
    const head = ["Indicador", monthShort(report.monthLabel), monthShort(report.previousMonthLabel), "Variação", ...(withTargets ? ["Meta", "Situação"] : [])];
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, top: 20, bottom: 20 },
      rowPageBreak: "avoid",
      head: [head],
      body: service.rows.map((r) => [indicatorName(r), formatValue(r, r.value), formatValue(r, r.previous), formatDelta(r), ...(withTargets ? [formatTarget(r), situationLabel(r)] : [])]),
      theme: "plain",
      styles: { font: "helvetica", fontSize: 8.2, cellPadding: { top: 2.2, bottom: 2.2, left: 2.5, right: 2.5 }, textColor: NAVY, lineColor: LINE, lineWidth: { bottom: 0.15 } },
      headStyles: { fillColor: service.accent, textColor: "#ffffff", fontStyle: "bold", fontSize: 8, lineWidth: 0 },
      alternateRowStyles: { fillColor: service.soft },
      columnStyles: { 0: { cellWidth: "auto" }, 1: { halign: "right", cellWidth: 22, fontStyle: "bold" }, 2: { halign: "right", cellWidth: 22, textColor: MUTED }, 3: { halign: "right", cellWidth: 24 }, 4: { halign: "right", cellWidth: 24 }, 5: { halign: "center", cellWidth: 24 } },
      didParseCell: (data) => {
        if (data.section === "head") { data.cell.styles.halign = data.column.index === 0 ? "left" : data.column.index === 5 ? "center" : "right"; return; }
        if (data.section !== "body") return;
        const row = service.rows[data.row.index];
        if (data.column.index === 0 && row.highlight) data.cell.styles.fontStyle = "bold";
        if (data.column.index === 3 && row.delta !== null && Math.abs(row.delta) > 1e-9) data.cell.styles.textColor = MUTED;
        if (data.column.index === 5 && row.achieved !== null) { data.cell.styles.textColor = row.achieved ? GREEN : RED; data.cell.styles.fontStyle = "bold"; }
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  sectionTitle("Escalas clínicas", "Evolução entre a avaliação de entrada e a de saída", PRIMARY);
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, top: 20, bottom: 20 },
    head: [["Escala", "Avaliações", "Saídas avaliadas", "Saídas com melhora", "Índice de melhora"]],
    body: report.scales.map((x) => [x.name, integer.format(x.assessments), integer.format(x.exits), integer.format(x.improved), x.rate === null ? "—" : `${pct.format(x.rate)}%`]),
    theme: "plain",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2.4, textColor: NAVY, lineColor: LINE, lineWidth: { bottom: 0.15 } },
    headStyles: { fillColor: PRIMARY, textColor: "#ffffff", fontStyle: "bold" },
    alternateRowStyles: { fillColor: "#eef2f7" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right", fontStyle: "bold" } },
    didParseCell: (data) => { if (data.section === "head" && data.column.index > 0) data.cell.styles.halign = "right"; },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  ensureSpace(16);
  doc.setTextColor(MUTED); doc.setFontSize(7.5);
  doc.text(doc.splitTextToSize("Notas: contagens são somadas no mês; taxas digitadas são a média do mês; taxas calculadas usam soma(numerador) ÷ soma(denominador). Variação de taxas em pontos percentuais (p.p.). Em destaque, os indicadores principais de cada serviço.", W - 2 * M), M, y);

  // Rodapé e cabeçalho reduzido em todas as páginas
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    if (i > 1) {
      doc.setFillColor(NAVY); doc.rect(0, 0, W, 10, "F");
      doc.setTextColor("#ffffff"); doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.text("MaisFisio · Relatório mensal", M, 6.5);
      doc.setFont("helvetica", "normal"); doc.text(`${report.unitName} · ${capitalize(report.monthLabel)}`, W - M, 6.5, { align: "right" });
    }
    doc.setDrawColor(LINE); doc.setLineWidth(0.2); doc.line(M, H - 13, W - M, H - 13);
    doc.setTextColor(MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    doc.text("MaisFisio HUB · Documento interno com dados assistenciais agregados", M, H - 8);
    doc.text(`Página ${i} de ${pages}`, W - M, H - 8, { align: "right" });
  }

  doc.save(`${fileBase(report)}.pdf`);
}

export async function exportReportXlsx(report: MonthlyReport) {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  const current = capitalize(report.monthLabel); const previous = capitalize(report.previousMonthLabel);

  // Resumo
  const s = report.summary;
  const summary = XLSX.utils.aoa_to_sheet([
    ["MaisFisio — Relatório mensal de produção assistencial"],
    [],
    ["Unidade", report.unitName],
    ["Competência", current],
    ["Comparação com", previous],
    ["Gerado em", dateTime.format(report.generatedAt)],
    [],
    ["Indicadores com registro", s.indicators],
    ["Metas avaliadas", s.targetsTotal],
    ["Metas atingidas", s.targetsAchieved],
    ["Avaliações clínicas", s.assessments],
    ["Saídas com melhora (%)", s.improvementRate === null ? null : Number(s.improvementRate.toFixed(2))],
    [],
    ["Serviço", "Indicadores", "Metas atingidas"],
    ...report.services.map((x) => [x.name, x.rows.length, `${x.rows.filter((r) => r.achieved).length} de ${x.rows.filter((r) => r.achieved !== null).length}`]),
  ]);
  summary["!cols"] = [{ wch: 34 }, { wch: 40 }, { wch: 18 }];
  summary["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  XLSX.utils.book_append_sheet(book, summary, "Resumo");

  // Produção: uma tabela com filtro, pronta para tabela dinâmica
  const header = ["Serviço", "Contexto", "Indicador", "Tipo", current, previous, "Variação", "Unidade da variação", "Meta", "Tipo de meta", "Situação", "Destaque"];
  const rows = report.services.flatMap((service) => service.rows.map((r) => [
    service.name,
    contextLabel(r.context) ?? "Geral",
    r.name,
    r.kind === "taxa" ? "Taxa (%)" : "Contagem",
    r.value,
    r.previous,
    r.delta === null ? null : r.deltaKind === "pp" ? Number(r.delta.toFixed(4)) : Number(r.delta.toFixed(6)),
    r.delta === null ? "" : r.deltaKind === "pp" ? "p.p." : "%",
    r.target?.value ?? null,
    r.target ? (r.target.comparison === "maximo" ? "Máximo" : "Mínimo") : "",
    situationLabel(r) === "—" ? "" : situationLabel(r),
    r.highlight ? "Sim" : "",
  ]));
  const production = XLSX.utils.aoa_to_sheet([header, ...rows]);
  production["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 60 }, { wch: 11 }, { wch: 14 }, { wch: 14 }, { wch: 11 }, { wch: 9 }, { wch: 10 }, { wch: 11 }, { wch: 13 }, { wch: 9 }];
  production["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: header.length - 1 } }) };
  // Formatos numéricos: valores com 2 casas; variação relativa em %.
  rows.forEach((row, i) => {
    const r = i + 1;
    for (const c of [4, 5, 8]) { const cell = production[XLSX.utils.encode_cell({ r, c })]; if (cell && typeof cell.v === "number") cell.z = "#,##0.00"; }
    const deltaCell = production[XLSX.utils.encode_cell({ r, c: 6 })];
    if (deltaCell && typeof deltaCell.v === "number") deltaCell.z = row[7] === "%" ? "+0.00%;-0.00%;0.00%" : "+0.00;-0.00;0.00";
  });
  XLSX.utils.book_append_sheet(book, production, "Produção");

  // Escalas
  const scales = XLSX.utils.aoa_to_sheet([
    ["Escala", "Avaliações", "Saídas avaliadas", "Saídas com melhora", "Índice de melhora (%)"],
    ...report.scales.map((x) => [x.name, x.assessments, x.exits, x.improved, x.rate === null ? null : Number(x.rate.toFixed(2))]),
  ]);
  scales["!cols"] = [{ wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(book, scales, "Escalas clínicas");

  book.Props = { Title: `Relatório mensal ${current} — ${report.unitName}`, Author: "MaisFisio HUB", CreatedDate: report.generatedAt };
  XLSX.writeFile(book, `${fileBase(report)}.xlsx`, { compression: true });
}
