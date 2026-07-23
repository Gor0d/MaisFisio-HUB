import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminView } from "@/components/admin-view";
import { SetupRequired } from "@/components/setup-required";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { getActiveUnitId, getUserUnits } from "@/lib/units";

export const metadata: Metadata = { title: "Administração" };

export default async function AdminPage() {
  if (!isSupabaseConfigured()) return <div className="grid gap-6"><header><h1 className="page-title">Administração</h1><p className="page-description">Usuários, catálogos, metas e auditoria.</p></header><SetupRequired /></div>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const profile = await supabase.from("profiles").select("user_id,full_name,role,service_id").eq("user_id", user!.id).single();
  if (profile.data?.role === "colaborador") redirect("/dashboard");
  const [services, collaborators, collaboratorUnits, indicators, sectors, serviceSectors, targets, audit] = await Promise.all([
    supabase.from("services").select("id,name,code").eq("active", true).order("name"),
    supabase.from("collaborators").select("id,canonical_name,service_id,user_id,active,services(name)").order("canonical_name"),
    supabase.from("collaborator_units").select("collaborator_id,unit_id"),
    supabase.from("indicators").select("id,code,name,service_id,context,kind,active,services(name)").order("name"),
    supabase.from("sectors").select("id,unit_id,code,name,context").eq("active", true).order("name"),
    supabase.from("service_sectors").select("service_id,sector_id"),
    supabase.from("indicator_targets").select("id,target_value,comparison,valid_from,valid_until,indicator_id,unit_id,sector_id,indicators(name),sectors(name),units(name)").order("valid_from", { ascending: false }),
    supabase.from("audit_logs").select("id,table_name,action,changed_at,record_id,profiles:changed_by(full_name)").order("changed_at", { ascending: false }).limit(100),
  ]);
  const units = await getUserUnits(supabase, profile.data as Profile);
  const activeUnitId = await getActiveUnitId(units, profile.data as Profile);
  return <AdminView role={profile.data!.role} currentServiceId={profile.data!.service_id} units={units} activeUnitId={activeUnitId} services={services.data ?? []} collaborators={collaborators.data ?? []} collaboratorUnits={collaboratorUnits.data ?? []} indicators={indicators.data ?? []} sectors={sectors.data ?? []} serviceSectors={serviceSectors.data ?? []} targets={targets.data ?? []} audit={audit.data ?? []} />;
}
