import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const DEFAULT_FILE = "Hospital Público Estadual Galileu - Produção Assistencial.xlsx";
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || !process.env.SUPABASE_SERVICE_ROLE_KEY;
const fileArgIndex = process.argv.indexOf("--file");
const inputFile = path.resolve(fileArgIndex >= 0 ? process.argv[fileArgIndex + 1] : DEFAULT_FILE);
const reportDir = path.resolve("reports");

type Cell = string | number | boolean | Date | null | undefined;
type LogicalValue = { code: string; value: number | string };
export type ProductionImport = { source: string; row: number; service: string; context: string; date: string; shift: string; sector: string; sectorType: string | null; collaborator: string; values: LogicalValue[] };
export type ScaleImport = { source: string; row: number; scaleType: "barthel" | "mrc" | "melhoria_uti"; date: string; initials: string; recordNumber: string; moment: "entrada" | "saida"; sector: string; sectorType: string | null; collaborator: string | null; attendanceNumber: string | null; age: number | null; cid: string | null; eventDate: string | null; notes: string | null; answers: { itemCode: string; points: number }[] };
type Issue = { sheet: string; row: number; level: "corrigida" | "rejeitada" | "revisao"; reason: string; original?: string };

const issues: Issue[] = [];
const correctionYears: Record<string, string> = { "0202": "2022", "0204": "2024", "0224": "2024" };

export function normalizeText(value: Cell) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

export function normalizeKey(value: Cell) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function parseNumber(value: Cell): number | null {
  if (value === null || value === undefined || value === "" || value === "-" || String(value).startsWith("#")) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function parseDate(value: Cell): { date: string | null; corrected?: string } {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return { date: value.toISOString().slice(0, 10) };
  if (typeof value === "number") {
    const decoded = XLSX.SSF.parse_date_code(value);
    if (!decoded) return { date: null };
    return validateDate(decoded.y, decoded.m, decoded.d);
  }
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:\s|$)/);
  if (!match) return { date: null };
  let yearText = match[3].padStart(4, "0");
  let corrected: string | undefined;
  if (correctionYears[yearText]) { corrected = `${yearText}→${correctionYears[yearText]}`; yearText = correctionYears[yearText]; }
  else if (yearText.length === 2 || Number(yearText) < 100) { corrected = `${yearText}→20${yearText.slice(-2)}`; yearText = `20${yearText.slice(-2)}`; }
  return { ...validateDate(Number(yearText), Number(match[2]), Number(match[1])), corrected };
}

function validateDate(year: number, month: number, day: number): { date: string | null } {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || year < 2020 || year > new Date().getUTCFullYear() + 1) return { date: null };
  return { date: date.toISOString().slice(0, 10) };
}

function canonicalSector(value: Cell, fallback?: string) {
  const key = normalizeKey(value || fallback);
  const aliases: Record<string, string> = {
    "uti": "uti", "enfermaria azul": "enfermaria_azul", "enfermaria laranja": "enfermaria_laranja",
    "enfermaria amarela": "enfermaria_amarela", "enfermaria verde": "enfermaria_verde",
    "clinica verde": "clinica_verde", "clinica amarela": "clinica_amarela", "clinica laranja": "clinica_laranja",
    "clinica azul": "clinica_azul", "ambulatorio": "ambulatorio",
  };
  return aliases[key] ?? "";
}

function canonicalShift(value: Cell) {
  const key = normalizeKey(value); return key === "manha" ? "MANHÃ" : key === "tarde" ? "TARDE" : key === "noite" ? "NOITE" : "";
}

function canonicalMoment(value: Cell): "entrada" | "saida" | null {
  const key = normalizeKey(value); if (key.includes("entrada")) return "entrada"; if (key.includes("saida")) return "saida"; return null;
}

function canonicalCollaborator(value: Cell) {
  return normalizeText(value).toUpperCase();
}

function canonicalSectorType(value: Cell) {
  const key = normalizeKey(value);
  return key === "medica" ? "Médica" : key === "ortopedica" ? "Ortopédica" : key === "cirurgica" ? "Cirúrgica" : null;
}

export const productionSheets = [
  { sheet: "Fisioterapia", service: "fisioterapia", context: "geral", header: 0, dims: [0, 1, 3, 2, 4], codes: ["fisio_pacientes_internados","fisio_pacientes_prescritos","fisio_taxa_captados","fisio_altas","fisio_intubacoes","fisio_quedas","fisio_taxa_extubacoes","fisio_obitos","fisio_pcr","fisio_taxa_respiratoria","fisio_taxa_motora","fisio_paciente_dia_via_aerea","fisio_taxa_aspirados","fisio_expectativa_sedestacao","fisio_taxa_sedestacoes","fisio_expectativa_ortostatismo","fisio_taxa_ortostatismo","fisio_taxa_deambulacao","fisio_pronacao","fisio_oxigenoterapia","fisio_visita_multidisciplinar","fisio_taxa_vni","fisio_taxa_vm_invasiva","fisio_traqueostomia","fisio_nao_deambulavam"] },
  { sheet: "Terapia Ocupacional - Atendimen", service: "terapia_ocupacional", context: "geral", header: 0, dims: [0,1,2,3,4], codes: ["to_geral_visita_multi","to_geral_palestra","to_geral_treinamento","to_geral_total","to_geral_ortese_descompressao","to_geral_ortese_posicionamento","to_geral_protese"] },
  { sheet: "Terapia Ocupacional - Enfermari", service: "terapia_ocupacional", context: "enfermaria", header: 0, dims: [0,1,2,3,4], codes: ["to_enf_atendimentos","to_enf_familiar","to_enf_visita_multi","to_enf_grupo","to_enf_altas","to_enf_adesoes","to_enf_dor","to_enf_altas_orientadas","to_enf_total","to_enf_ortese_descompressao","to_enf_ortese_posicionamento","to_enf_protese","to_enf_interconsultas"] },
  { sheet: " Terapia Ocupacional - Ambulató", service: "terapia_ocupacional", context: "ambulatorio", header: 1, dims: [0,1,2,3,-1], codes: ["to_amb_interconsultas","to_amb_grupo","to_amb_individual","to_amb_adesao","to_amb_altas","to_amb_dor_usuarios","to_amb_dor_pacientes","to_amb_taxa_ganho","to_amb_total","to_amb_ortese_descompressao","to_amb_ortese_posicionamento","to_amb_protese"] },
  { sheet: "Psicologia - 2026", service: "psicologia", context: "geral", header: 0, dims: [0,1,2,3,-1], codes: ["psi_atendimentos","psi_admissoes","psi_elegibilidade","psi_acompanhamento","psi_visita_especial","psi_encaminhamento","psi_interconsulta","psi_visita_multi","psi_familiar","psi_risco_suicidio","psi_avaliados","psi_acolhimento_obito"] },
  { sheet: "Psicologia UTI", service: "psicologia", context: "uti", header: 1, dims: [0,1,2,3,-1], codes: ["psi_uti_atendimentos","psi_uti_admissoes","psi_uti_acompanhamento","psi_uti_encaminhamento","psi_uti_acolhimento_obito","psi_uti_familiar","psi_uti_visita_multi","psi_uti_risco_suicidio"] },
  { sheet: "Fonoaudiologia", service: "fonoaudiologia", context: "geral", header: 0, dims: [0,1,2,3,4], codes: ["fono_atendimentos","fono_familiar","fono_visita_multi","fono_interconsulta","fono_broncoaspiracoes","fono_melhorias","fono_altas"] },
  { sheet: "Assistência Social", service: "assistencia_social", context: "geral", header: 0, dims: [0,1,2,3,4], codes: ["social_atendimentos","social_acolhimento","social_ambulatorio_admissao","social_tfd","social_acionamento_familiar","social_rede_externa","social_visita_multi","social_alta","social_avaliados","social_permanencia_pos_alta","social_sem_suporte","social_evasoes","social_acompanhamentos","social_acionamentos_evasao","social_transporte","social_acolhimento_obito"] },
] as const;

export function parseProductionSheet(workbook: XLSX.WorkBook, config: (typeof productionSheets)[number]): ProductionImport[] {
  const sheet = workbook.Sheets[config.sheet]; if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, raw: true, defval: null }); const result: ProductionImport[] = [];
  for (let index = config.header + 1; index < rows.length; index++) {
    const row = rows[index]; if (!row?.some((x) => x !== null && x !== "")) continue;
    const [dateCol, collaboratorCol, shiftCol, sectorCol, typeCol] = config.dims; const parsedDate = parseDate(row[dateCol]);
    const shift = canonicalShift(row[shiftCol]); const collaborator = canonicalCollaborator(row[collaboratorCol]); const sector = canonicalSector(row[sectorCol], config.context === "ambulatorio" ? "Ambulatório" : undefined);
    if (!parsedDate.date || !shift || !collaborator || !sector) { issues.push({ sheet: config.sheet, row: index + 1, level: "rejeitada", reason: `Dimensão inválida: data=${String(row[dateCol])}, turno=${String(row[shiftCol])}, colaborador=${collaborator}, setor=${String(row[sectorCol])}` }); continue; }
    if (parsedDate.corrected) issues.push({ sheet: config.sheet, row: index + 1, level: "corrigida", reason: `Ano corrigido (${parsedDate.corrected})`, original: String(row[dateCol]) });
    if (collaborator.includes("/") || collaborator.includes(" E ")) issues.push({ sheet: config.sheet, row: index + 1, level: "revisao", reason: `Registro de equipe preservado como colaborador canônico: ${collaborator}` });
    const firstValueCol = Math.max(...config.dims.filter((x) => x >= 0)) + 1;
    const values: LogicalValue[] = [];
    config.codes.forEach((code, offset) => { const raw = row[firstValueCol + offset]; if (code === "to_enf_interconsultas") { if (normalizeText(raw)) values.push({ code, value: normalizeText(raw) }); } else { const value = parseNumber(raw); if (value !== null) values.push({ code, value }); } });
    result.push({ source: config.sheet, row: index + 1, service: config.service, context: config.context, date: parsedDate.date, shift, sector, sectorType: typeCol >= 0 ? canonicalSectorType(row[typeCol]) : null, collaborator, values });
  }
  return result;
}

const barthelItems = ["alimentacao","banho","higiene_pessoal","vestir","intestino","sistema_urinario","uso_toilet","transferencia","mobilidade","escadas"];
const mrcItems = ["ombro_e","ombro_d","cotovelo_e","cotovelo_d","pulso_e","pulso_d","quadril_e","quadril_d","joelho_e","joelho_d","pe_e","pe_d"];

function pointsFromOption(value: Cell, type: string, item: string): number | null {
  const text = normalizeText(value); if (!text) return null;
  if (type === "mrc") { const match = text.match(/grau\s*([0-5])/i); return match ? Number(match[1]) : null; }
  if (type === "melhoria_uti" && item === "respiracao") { const key = normalizeKey(text); return key.includes("mecanica") ? 1 : key.includes("suplementar") ? 2 : key.includes("espontanea") ? 3 : null; }
  const match = text.match(/^(\d+)/); return match ? Number(match[1]) : null;
}

export function parseScaleSheet(workbook: XLSX.WorkBook, type: ScaleImport["scaleType"]): ScaleImport[] {
  const config = type === "barthel" ? { sheet: "Escala de Barthel", header: 0, date: 0, initials: 1, record: 2, moment: 3, sector: 4, type: -1, collaborator: -1, attendance: -1, age: -1, cid: -1, event: -1, notes: -1, itemStart: 5, items: barthelItems }
    : type === "mrc" ? { sheet: "MRC - TABELA", header: 0, date: 0, initials: 2, record: 3, moment: 4, sector: 5, type: 6, collaborator: 1, attendance: 3, age: -1, cid: -1, event: -1, notes: -1, itemStart: 7, items: mrcItems }
    : { sheet: "Melhoria Funcional da UTI - Tab", header: 0, date: 0, initials: 1, record: 2, moment: 6, sector: -1, type: 5, collaborator: -1, attendance: -1, age: 3, cid: 4, event: 7, notes: 12, itemStart: 8, items: ["glasgow","forca_muscular","respiracao","mobilidade"] };
  const rows = XLSX.utils.sheet_to_json<Cell[]>(workbook.Sheets[config.sheet], { header: 1, raw: true, defval: null }); const result: ScaleImport[] = [];
  for (let index = config.header + 1; index < rows.length; index++) {
    const row = rows[index]; if (!row?.some((x) => x !== null && x !== "")) continue;
    const date = parseDate(row[config.date]); const moment = canonicalMoment(row[config.moment]); const initials = normalizeText(row[config.initials]).toUpperCase(); const recordNumber = normalizeText(row[config.record]); const sector = type === "melhoria_uti" ? "uti" : canonicalSector(row[config.sector]);
    const answers = config.items.map((item, offset) => ({ itemCode: item, points: pointsFromOption(row[config.itemStart + offset], type, item) })).filter((x): x is { itemCode: string; points: number } => x.points !== null);
    if (!date.date || !moment || !initials || !recordNumber || !sector || answers.length !== config.items.length) { issues.push({ sheet: config.sheet, row: index + 1, level: "rejeitada", reason: `Avaliação incompleta/inválida: data=${String(row[config.date])}, prontuário=${recordNumber}, respostas=${answers.length}/${config.items.length}` }); continue; }
    if (date.corrected) issues.push({ sheet: config.sheet, row: index + 1, level: "corrigida", reason: `Ano corrigido (${date.corrected})`, original: String(row[config.date]) });
    const eventDate = config.event >= 0 ? parseDate(row[config.event]).date : null;
    result.push({ source: config.sheet, row: index + 1, scaleType: type, date: date.date, initials, recordNumber, moment, sector, sectorType: config.type >= 0 ? canonicalSectorType(row[config.type]) : null, collaborator: config.collaborator >= 0 ? canonicalCollaborator(row[config.collaborator]) || null : null, attendanceNumber: config.attendance >= 0 ? normalizeText(row[config.attendance]) || null : null, age: config.age >= 0 ? parseNumber(row[config.age]) : null, cid: config.cid >= 0 ? normalizeText(row[config.cid]) || null : null, eventDate, notes: config.notes >= 0 ? normalizeText(row[config.notes]) || null : null, answers });
  }
  return result;
}

// Duplicatas da planilha colidiriam com as chaves únicas do banco (dimensões de
// produção e evento de avaliação); mantemos a primeira ocorrência e registramos o descarte.
function dedupeBy<T extends { source: string; row: number }>(rows: T[], keyOf: (x: T) => string, label: string): T[] {
  const kept = new Map<string, T>();
  for (const row of rows) {
    const key = keyOf(row); const first = kept.get(key);
    if (first) issues.push({ sheet: row.source, row: row.row, level: "revisao", reason: `${label} duplicado descartado (mantida a linha ${first.row}): ${key}` });
    else kept.set(key, row);
  }
  return [...kept.values()];
}

function stableUuid(key: string) { const hex = createHash("sha256").update(`maisfisio:${key}`).digest("hex").slice(0, 32).split(""); hex[12] = "5"; hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16); return `${hex.slice(0,8).join("")}-${hex.slice(8,12).join("")}-${hex.slice(12,16).join("")}-${hex.slice(16,20).join("")}-${hex.slice(20).join("")}`; }
async function batches<T>(items: T[], size: number, fn: (batch: T[]) => Promise<void>) { for (let i = 0; i < items.length; i += size) await fn(items.slice(i, i + size)); }
async function allRows(client: SupabaseClient, table: string, columns: string) { const result: any[] = []; for (let from = 0;; from += 1000) { const { data, error } = await client.from(table).select(columns).range(from, from + 999); if (error) throw error; result.push(...(data ?? [])); if (!data || data.length < 1000) return result; } }

async function upload(production: ProductionImport[], scales: ScaleImport[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para importar.");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const profiles = await allRows(client, "profiles", "user_id,role"); const actor = process.env.IMPORT_USER_ID ?? profiles.find((x) => x.role === "admin")?.user_id;
  if (!actor) throw new Error("Crie um administrador ou configure IMPORT_USER_ID antes da importação real.");
  // Todo o histórico da planilha pertence ao Hospital Galileu.
  const [units, services, allSectors, indicators, items, options, existingCollaborators] = await Promise.all([allRows(client,"units","id,code"), allRows(client,"services","id,code"), allRows(client,"sectors","id,code,unit_id"), allRows(client,"indicators","id,code"), allRows(client,"scale_items","id,scale_type,code"), allRows(client,"scale_item_options","id,item_id,points"), allRows(client,"collaborators","id,normalized_name,service_id")]);
  const unitId = units.find((x) => x.code === "galileu")?.id;
  if (!unitId) throw new Error("Unidade 'galileu' não encontrada; aplique o seed antes da importação.");
  const sectors = allSectors.filter((x) => x.unit_id === unitId);
  const serviceMap = new Map(services.map((x) => [x.code, x.id])); const sectorMap = new Map(sectors.map((x) => [x.code, x.id])); const indicatorMap = new Map(indicators.map((x) => [x.code, x.id]));
  const collaboratorMap = new Map(existingCollaborators.map((x) => [`${x.service_id}:${normalizeKey(x.normalized_name)}`, x.id]));
  const names = new Map<string, { name: string; service: string }>(); production.forEach((x) => names.set(`${x.service}:${normalizeKey(x.collaborator)}`, { name: x.collaborator, service: x.service })); scales.filter((x) => x.collaborator).forEach((x) => names.set(`fisioterapia:${normalizeKey(x.collaborator)}`, { name: x.collaborator!, service: "fisioterapia" }));
  const newCollaborators = [...names].filter(([key, x]) => !collaboratorMap.has(`${serviceMap.get(x.service)}:${key.split(":").slice(1).join(":")}`)).map(([key, x]) => ({ id: stableUuid(`collaborator:${key}`), canonical_name: x.name, service_id: serviceMap.get(x.service) }));
  if (newCollaborators.length) { const { error } = await client.from("collaborators").insert(newCollaborators); if (error) throw error; }
  [...names].forEach(([key, x]) => { const mapKey = `${serviceMap.get(x.service)}:${key.split(":").slice(1).join(":")}`; if (!collaboratorMap.has(mapKey)) collaboratorMap.set(mapKey, stableUuid(`collaborator:${key}`)); });
  const unitLinks = [...new Set(collaboratorMap.values())].map((collaborator_id) => ({ collaborator_id, unit_id: unitId }));
  await batches(unitLinks, 500, async (batch) => { const { error } = await client.from("collaborator_units").upsert(batch); if (error) throw error; });
  const patientRows = [...new Map(scales.map((x) => [x.recordNumber, x])).values()].map((x) => ({ unit_id: unitId, initials: x.initials, record_number: x.recordNumber, age: x.age })); const patientMap = new Map<string,string>();
  await batches(patientRows, 500, async (batch) => { const { data, error } = await client.from("patients").upsert(batch, { onConflict: "unit_id,record_number" }).select("id,record_number"); if (error) throw error; data?.forEach((x) => patientMap.set(x.record_number, x.id)); });
  await batches(production, 200, async (batch) => {
    const records = batch.map((x) => ({ id: stableUuid(`production:${unitId}:${x.service}:${x.date}:${x.shift}:${x.sector}:${normalizeKey(x.collaborator)}:${x.context}`), unit_id: unitId, service_id: serviceMap.get(x.service), record_date: x.date, shift: x.shift, sector_id: sectorMap.get(x.sector), sector_type: x.sectorType, collaborator_id: collaboratorMap.get(`${serviceMap.get(x.service)}:${normalizeKey(x.collaborator)}`), context: x.context, created_by: actor }));
    const { error } = await client.from("production_records").upsert(records, { onConflict: "id" }); if (error) throw error;
    const values = batch.flatMap((x, index) => x.values.map((v) => ({ record_id: records[index].id, indicator_id: indicatorMap.get(v.code), numeric_value: typeof v.value === "number" ? v.value : null, text_value: typeof v.value === "string" ? v.value : null })));
    if (values.length) { const result = await client.from("production_values").upsert(values, { onConflict: "record_id,indicator_id" }); if (result.error) throw result.error; }
  });
  const itemMap = new Map(items.map((x) => [`${x.scale_type}:${x.code}`, x.id])); const optionMap = new Map(options.map((x) => [`${x.item_id}:${x.points}`, x.id]));
  await batches(scales, 200, async (batch) => {
    const assessments = batch.map((x) => ({ id: stableUuid(`scale:${x.source}:${x.row}:${x.recordNumber}`), unit_id: unitId, scale_type: x.scaleType, patient_id: patientMap.get(x.recordNumber), collaborator_id: x.collaborator ? collaboratorMap.get(`${serviceMap.get("fisioterapia")}:${normalizeKey(x.collaborator)}`) : null, assessment_date: x.date, moment: x.moment, sector_id: sectorMap.get(x.sector), sector_type: x.sectorType, attendance_number: x.attendanceNumber, cid: x.cid, event_date: x.eventDate, notes: x.notes, created_by: actor }));
    const { error } = await client.from("scale_assessments").upsert(assessments, { onConflict: "id" }); if (error) throw error;
    const scores = batch.flatMap((x, index) => x.answers.map((answer) => { const itemId = itemMap.get(`${x.scaleType}:${answer.itemCode}`); return { assessment_id: assessments[index].id, item_id: itemId, option_id: optionMap.get(`${itemId}:${answer.points}`) }; }));
    const scoreResult = await client.from("scale_scores").upsert(scores, { onConflict: "assessment_id,item_id" }); if (scoreResult.error) throw scoreResult.error;
  });
}

async function main() {
  console.log(`Lendo ${inputFile} em modo ${dryRun ? "validação" : "importação"}...`);
  const workbook = XLSX.readFile(inputFile, { cellDates: false, raw: true });
  const production = dedupeBy(productionSheets.flatMap((config) => parseProductionSheet(workbook, config)), (x) => `${x.service}|${x.date}|${x.shift}|${x.sector}|${normalizeKey(x.collaborator)}|${x.context}`, "Lançamento");
  const scaleGroups = (["barthel", "mrc", "melhoria_uti"] as const).map((type) => [type, dedupeBy(parseScaleSheet(workbook, type), (x) => `${x.scaleType}|${x.recordNumber}|${x.date}|${x.moment}|${x.attendanceNumber ?? ""}`, "Evento de avaliação")] as const); const scales = scaleGroups.flatMap(([, rows]) => rows);
  if (!dryRun) await upload(production, scales);
  const physicalRows = Object.fromEntries([...productionSheets.map((config) => { const range = XLSX.utils.decode_range(workbook.Sheets[config.sheet]["!ref"] ?? "A1"); return [config.sheet.trim(), range.e.r - config.header]; }), ...(["Escala de Barthel", "MRC - TABELA", "Melhoria Funcional da UTI - Tab"] as const).map((sheet) => { const range = XLSX.utils.decode_range(workbook.Sheets[sheet]["!ref"] ?? "A1"); return [sheet, range.e.r]; })]);
  const report = { generatedAt: new Date().toISOString(), source: inputFile, mode: dryRun ? "dry-run" : "import", summary: { physicalRows, production: Object.fromEntries(productionSheets.map((x) => [x.sheet.trim(), production.filter((row) => row.source === x.sheet).length])), scales: Object.fromEntries(scaleGroups.map(([type, rows]) => [type, rows.length])), totalAccepted: production.length + scales.length, corrected: issues.filter((x) => x.level === "corrigida").length, review: issues.filter((x) => x.level === "revisao").length, rejected: issues.filter((x) => x.level === "rejeitada").length }, issues };
  await mkdir(reportDir, { recursive: true }); await writeFile(path.join(reportDir, "import-report.json"), JSON.stringify(report, null, 2), "utf8");
  const csv = ["aba;linha;nivel;motivo;original", ...issues.map((x) => [x.sheet,x.row,x.level,x.reason,x.original ?? ""].map((v) => `"${String(v).replaceAll('"','""')}"`).join(";"))].join("\n"); await writeFile(path.join(reportDir, "import-issues.csv"), `\uFEFF${csv}`, "utf8");
  console.log(JSON.stringify(report.summary, null, 2)); console.log(`Relatórios: ${path.join(reportDir, "import-report.json")} e import-issues.csv`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { console.error(error); process.exitCode = 1; });
