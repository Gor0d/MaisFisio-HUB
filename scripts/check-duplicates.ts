// Diagnóstico auxiliar: conta eventos duplicados (mesma escala, paciente, data,
// momento e atendimento) que colidiriam no índice único de scale_assessments.
import XLSX from "xlsx";
import { normalizeKey, parseProductionSheet, parseScaleSheet, productionSheets } from "./import-xlsx";

const workbook = XLSX.readFile("Hospital Público Estadual Galileu - Produção Assistencial.xlsx", { cellDates: false, raw: true });

for (const config of productionSheets) {
  const rows = parseProductionSheet(workbook, config);
  const seen = new Map<string, number>();
  for (const x of rows) {
    const key = `${x.service}|${x.date}|${x.shift}|${x.sector}|${normalizeKey(x.collaborator)}|${x.context}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const extras = [...seen.values()].filter((n) => n > 1).reduce((acc, n) => acc + n - 1, 0);
  console.log(`${config.sheet.trim()}: ${rows.length} aceitas, ${extras} linhas com dimensões repetidas`);
}
for (const type of ["barthel", "mrc", "melhoria_uti"] as const) {
  const rows = parseScaleSheet(workbook, type);
  const seen = new Map<string, number>();
  for (const x of rows) {
    const key = `${x.scaleType}|${x.recordNumber}|${x.date}|${x.moment}|${x.attendanceNumber ?? ""}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const dups = [...seen.entries()].filter(([, n]) => n > 1);
  const extras = dups.reduce((acc, [, n]) => acc + n - 1, 0);
  console.log(`${type}: ${rows.length} aceitas, ${dups.length} eventos duplicados (${extras} linhas em conflito)`);
  dups.slice(0, 5).forEach(([k, n]) => console.log(`  exemplo x${n}: ${k}`));
}
