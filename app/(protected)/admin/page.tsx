import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminView } from "@/components/admin-view";
import { SetupRequired } from "@/components/setup-required";
import { getSession } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Administração" };

export default async function AdminPage() {
  if (!isSupabaseConfigured()) return <div className="grid gap-6"><header><h1 className="page-title">Administração</h1><p className="page-description">Usuários, catálogos, metas e auditoria.</p></header><SetupRequired /></div>;
  // Reaproveita usuário/perfil/unidades já buscados pelo layout (React cache()).
  const { supabase, userId, profile, units, activeUnitId } = await getSession();
  if (profile.role === "colaborador") redirect("/dashboard");
  const [services, profiles, profileUnits, collaborators, collaboratorUnits, indicators, sectors, serviceSectors, targets, audit] = await Promise.all([
    supabase.from("services").select("id,name,code").eq("active", true).order("name"),
    supabase.from("profiles").select("user_id,full_name,role,service_id,active").order("full_name"),
    supabase.from("profile_units").select("user_id,unit_id"),
    supabase.from("collaborators").select("id,canonical_name,service_id,user_id,active,services(name)").order("canonical_name"),
    supabase.from("collaborator_units").select("collaborator_id,unit_id"),
    supabase.from("indicators").select("id,code,name,service_id,context,kind,active,services(name)").order("name"),
    supabase.from("sectors").select("id,unit_id,code,name,context").eq("active", true).order("name"),
    supabase.from("service_sectors").select("service_id,sector_id"),
    supabase.from("indicator_targets").select("id,target_value,comparison,valid_from,valid_until,indicator_id,unit_id,sector_id,indicators(name),sectors(name),units(name)").order("valid_from", { ascending: false }),
    supabase.from("audit_logs").select("id,table_name,action,changed_at,record_id,profiles:changed_by(full_name)").order("changed_at", { ascending: false }).limit(100),
  ]);
  return <AdminView role={profile.role} currentUserId={userId!} currentServiceId={profile.service_id} units={units} activeUnitId={activeUnitId} services={services.data ?? []} profiles={profiles.data ?? []} profileUnits={profileUnits.data ?? []} collaborators={collaborators.data ?? []} collaboratorUnits={collaboratorUnits.data ?? []} indicators={indicators.data ?? []} sectors={sectors.data ?? []} serviceSectors={serviceSectors.data ?? []} targets={targets.data ?? []} audit={audit.data ?? []} />;
}
