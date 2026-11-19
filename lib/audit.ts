// Leitura humana da trilha de auditoria (audit_logs): rótulos, o que mudou
// em cada alteração e uma descrição curta do registro afetado.

export type AuditAction = "INSERT" | "UPDATE" | "DELETE";

export type AuditRow = {
  id: number;
  changed_at: string;
  action: AuditAction;
  table_name: string;
  record_id: string | null;
  unit_id: string | null;
  changed_by: string | null;
  changed_by_name: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  total_count?: number | string;
};

export type AccessRow = {
  id: string;
  created_at: string;
  action: string;
  user_id: string | null;
  user_name: string | null;
  email: string | null;
  ip_address: string | null;
  total_count?: number | string;
};

/** id (uuid) → nome legível: setores, unidades, serviços, colaboradores, indicadores, usuários, pacientes. */
export type NameLookup = Record<string, string>;

export const ACTION_LABELS: Record<AuditAction, string> = { INSERT: "Criação", UPDATE: "Alteração", DELETE: "Exclusão" };

export const ENTITY_LABELS: Record<string, string> = {
  production_records: "Lançamento de produção",
  scale_assessments: "Avaliação de escala",
  collaborators: "Colaborador",
  profiles: "Usuário",
  profile_units: "Acesso de usuário à unidade",
  collaborator_units: "Vínculo de colaborador à unidade",
  indicator_targets: "Meta",
  quality_indicators: "Indicador de qualidade",
  indicators: "Indicador (catálogo)",
  sectors: "Setor",
  units: "Unidade",
  service_sectors: "Setor atendido pelo serviço",
};

export const ACCESS_LABELS: Record<string, string> = {
  login: "Entrada no sistema",
  logout: "Saída do sistema",
  user_signedup: "Conta criada",
  user_invited: "Convite enviado",
  user_recovery_requested: "Pediu redefinição de senha",
  user_updated_password: "Trocou a senha",
  user_modified: "Dados da conta alterados",
  user_deleted: "Conta excluída",
  user_confirmation_requested: "Confirmação de e-mail solicitada",
};

const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  canonical_name: "Nome",
  full_name: "Nome",
  code: "Código",
  active: "Ativo",
  role: "Perfil",
  unit_id: "Unidade",
  service_id: "Serviço",
  sector_id: "Setor",
  sector_type: "Tipo de setor",
  collaborator_id: "Colaborador",
  user_id: "Usuário",
  patient_id: "Paciente",
  indicator_id: "Indicador",
  record_date: "Data",
  assessment_date: "Data da avaliação",
  event_date: "Data do evento",
  shift: "Turno",
  context: "Contexto",
  notes: "Observações",
  scale_type: "Escala",
  moment: "Momento",
  attendance_number: "Atendimento",
  cid: "CID",
  target_value: "Meta",
  comparison: "Comparação",
  valid_from: "Vigente desde",
  valid_until: "Vigente até",
  interact_code: "Código Interact",
  numerator_ids: "Numerador",
  denominator_ids: "Denominador",
  sector_ids: "Setores",
  multiplier: "Multiplicador",
  result_unit: "Unidade do resultado",
  decimals: "Casas decimais",
  target_comparison: "Comparação da meta",
  kind: "Tipo",
  derived: "Calculado",
  display_order: "Ordem",
};

/** Campos técnicos que não interessam a quem audita. */
const IGNORED_FIELDS = new Set(["id", "created_at", "updated_at", "created_by", "total", "answered_items", "expected_items", "complete"]);

const SCALE_LABELS: Record<string, string> = { barthel: "Barthel", mrc: "MRC", melhoria_uti: "Melhoria UTI" };
const ROLE_LABELS: Record<string, string> = { super_admin: "Matriz", admin: "Administrador", coordenador: "Coordenador", colaborador: "Colaborador" };
const MOMENT_LABELS: Record<string, string> = { entrada: "Entrada", saida: "Saída" };
const COMPARISON_LABELS: Record<string, string> = { minimo: "Mínimo", maximo: "Máximo" };

export function entityLabel(table: string) {
  return ENTITY_LABELS[table] ?? table;
}

export function fieldLabel(field: string) {
  return FIELD_LABELS[field] ?? field.replace(/_/g, " ");
}

function isoDateBr(value: string) {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}

/** Valor de um campo em texto legível (ids viram nomes quando conhecidos). */
export function formatAuditValue(field: string, value: unknown, names: NameLookup = {}): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.map((v) => formatAuditValue(field, v, names)).join(", ") : "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "object") return JSON.stringify(value);
  const text = String(value);
  if (field === "scale_type") return SCALE_LABELS[text] ?? text;
  if (field === "role") return ROLE_LABELS[text] ?? text;
  if (field === "moment") return MOMENT_LABELS[text] ?? text;
  if (field === "comparison" || field === "target_comparison") return COMPARISON_LABELS[text] ?? text;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return isoDateBr(text);
  if (names[text]) return names[text];
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(text)) return `${text.slice(0, 8)}…`;
  return text;
}

export type AuditChange = { field: string; label: string; before: string; after: string };

/**
 * O que mudou: na alteração, só os campos diferentes; na criação, os valores
 * gravados; na exclusão, os valores que existiam.
 */
export function auditChanges(row: Pick<AuditRow, "action" | "old_data" | "new_data">, names: NameLookup = {}): AuditChange[] {
  const before = row.old_data ?? {};
  const after = row.new_data ?? {};
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((f) => !IGNORED_FIELDS.has(f));
  const changed = row.action === "UPDATE"
    ? fields.filter((f) => JSON.stringify(before[f] ?? null) !== JSON.stringify(after[f] ?? null))
    : fields.filter((f) => (row.action === "INSERT" ? after[f] : before[f]) !== null && (row.action === "INSERT" ? after[f] : before[f]) !== undefined);
  return changed.map((field) => ({
    field,
    label: fieldLabel(field),
    before: row.action === "INSERT" ? "—" : formatAuditValue(field, before[field], names),
    after: row.action === "DELETE" ? "—" : formatAuditValue(field, after[field], names),
  }));
}

/** Uma linha que identifica o registro afetado (ex.: "Barthel · Entrada · 12/10/2026 · Enfermaria Azul"). */
export function describeAuditRecord(row: Pick<AuditRow, "table_name" | "old_data" | "new_data" | "record_id">, names: NameLookup = {}): string {
  const d = { ...(row.old_data ?? {}), ...(row.new_data ?? {}) } as Record<string, unknown>;
  const v = (field: string) => (d[field] === null || d[field] === undefined || d[field] === "" ? null : formatAuditValue(field, d[field], names));
  const parts: Array<string | null> = (() => {
    switch (row.table_name) {
      case "production_records": return [v("service_id"), v("record_date"), v("shift"), v("sector_id")];
      case "scale_assessments": return [v("scale_type"), v("moment"), v("assessment_date"), v("sector_id"), d.patient_id ? `Paciente ${v("patient_id")}` : null];
      case "collaborators": return [v("canonical_name")];
      case "profiles": return [v("full_name"), v("role")];
      case "profile_units": return [v("user_id"), v("unit_id")];
      case "collaborator_units": return [v("collaborator_id"), v("unit_id")];
      case "indicator_targets": return [v("indicator_id"), d.target_value !== undefined ? `meta ${v("target_value")}` : null, v("sector_id")];
      case "quality_indicators": return [v("interact_code"), v("name")];
      case "indicators": return [v("code"), v("name")];
      case "sectors": return [v("name"), v("unit_id")];
      case "units": return [v("name")];
      case "service_sectors": return [v("service_id"), v("sector_id")];
      default: return [row.record_id ? formatAuditValue("id", row.record_id, names) : null];
    }
  })();
  return parts.filter(Boolean).join(" · ") || "—";
}

/** ids citados nas linhas (para buscar os nomes de uma vez). */
export function collectAuditIds(rows: Array<Pick<AuditRow, "old_data" | "new_data">>, fields: string[]): string[] {
  const out = new Set<string>();
  for (const row of rows) {
    for (const data of [row.old_data, row.new_data]) {
      if (!data) continue;
      for (const field of fields) {
        const value = data[field];
        for (const item of Array.isArray(value) ? value : [value]) if (typeof item === "string" && item) out.add(item);
      }
    }
  }
  return [...out];
}

export function auditOrigin(row: Pick<AuditRow, "changed_by" | "changed_by_name">) {
  if (!row.changed_by) return "Sistema (importação)";
  return row.changed_by_name ?? "Usuário removido";
}

export function accessLabel(action: string) {
  return ACCESS_LABELS[action] ?? action.replace(/_/g, " ");
}
