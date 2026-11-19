import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuditView, type AuditFilters } from "@/components/audit-view";
import { SetupRequired } from "@/components/setup-required";
import { collectAuditIds, ENTITY_LABELS, type AccessRow, type AuditRow, type NameLookup } from "@/lib/audit";
import { getSession } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { todayISO } from "@/lib/utils";

export const metadata: Metadata = { title: "Auditoria" };

const PAGE_SIZE = 50;
const iso = (value?: string) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);
const uuid = (value?: string) => (value && /^[0-9a-f-]{36}$/i.test(value) ? value : null);

function daysBefore(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!isSupabaseConfigured()) return <div className="grid gap-6"><header><h1 className="page-title">Auditoria</h1><p className="page-description">Quem fez o quê e quando.</p></header><SetupRequired /></div>;
  const { supabase, profile, units, activeUnitId } = await getSession();
  // Auditoria: exclusiva de administrador e matriz.
  if (profile.role !== "admin" && profile.role !== "super_admin") redirect("/dashboard");

  const p = await searchParams;
  const today = todayISO();
  const filters: AuditFilters = {
    aba: p.aba === "acessos" ? "acessos" : "alteracoes",
    de: iso(p.de) ?? daysBefore(today, 30),
    ate: iso(p.ate) ?? today,
    entidade: p.entidade && ENTITY_LABELS[p.entidade] ? p.entidade : "",
    acao: ["INSERT", "UPDATE", "DELETE"].includes(p.acao ?? "") ? p.acao! : "",
    usuario: uuid(p.usuario) ?? "",
    origem: p.origem === "todos" || p.origem === "sistema" ? p.origem : "usuarios",
    pagina: Math.max(1, Number.parseInt(p.pagina ?? "1", 10) || 1),
  };
  const offset = (filters.pagina - 1) * PAGE_SIZE;

  const [sectors, services, collaborators, indicators, profiles, profileUnits] = await Promise.all([
    supabase.from("sectors").select("id,name"),
    supabase.from("services").select("id,name"),
    supabase.from("collaborators").select("id,canonical_name"),
    supabase.from("indicators").select("id,name"),
    supabase.from("profiles").select("user_id,full_name").order("full_name"),
    supabase.from("profile_units").select("user_id,unit_id"),
  ]);
  const names: NameLookup = {};
  for (const u of units) names[u.id] = u.name;
  for (const s of sectors.data ?? []) names[s.id] = s.name;
  for (const s of services.data ?? []) names[s.id] = s.name;
  for (const c of collaborators.data ?? []) names[c.id] = c.canonical_name;
  for (const i of indicators.data ?? []) names[i.id] = i.name;
  for (const u of profiles.data ?? []) names[u.user_id] = u.full_name;
  const unitUsers = activeUnitId ? new Set((profileUnits.data ?? []).filter((l) => l.unit_id === activeUnitId).map((l) => l.user_id)) : null;
  const actors = (profiles.data ?? []).filter((u) => !unitUsers || unitUsers.has(u.user_id)).map((u) => ({ id: u.user_id, name: u.full_name }));

  let changes: AuditRow[] = [];
  let access: AccessRow[] = [];
  let total = 0;
  let error: string | null = null;
  if (filters.aba === "alteracoes") {
    const res = await supabase.rpc("audit_log_search", {
      p_unit: activeUnitId, p_start: filters.de, p_end: filters.ate,
      p_tables: filters.entidade ? [filters.entidade] : null,
      p_actions: filters.acao ? [filters.acao] : null,
      p_actor: filters.usuario || null, p_origin: filters.origem,
      p_limit: PAGE_SIZE, p_offset: offset,
    });
    changes = (res.data ?? []) as AuditRow[];
    total = Number(changes[0]?.total_count ?? 0);
    error = res.error?.message ?? null;
    // Pacientes citados nesta página: identificados pelo prontuário.
    const patientIds = collectAuditIds(changes, ["patient_id"]);
    if (patientIds.length) {
      const patients = await supabase.from("patients").select("id,record_number,initials").in("id", patientIds);
      for (const pt of patients.data ?? []) names[pt.id] = `${pt.initials ?? ""} · pront. ${pt.record_number ?? "—"}`.trim();
    }
  } else {
    const res = await supabase.rpc("audit_access_log", { p_unit: activeUnitId, p_start: filters.de, p_end: filters.ate, p_limit: PAGE_SIZE, p_offset: offset });
    access = (res.data ?? []) as AccessRow[];
    total = Number(access[0]?.total_count ?? 0);
    error = res.error?.message ?? null;
  }

  const unitName = units.find((u) => u.id === activeUnitId)?.name ?? "Todas as unidades";
  return <AuditView filters={filters} changes={changes} access={access} total={total} pageSize={PAGE_SIZE} names={names} actors={actors} unitName={unitName} activeUnitId={activeUnitId} error={error} today={today} />;
}
