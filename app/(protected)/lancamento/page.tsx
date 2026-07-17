import type { Metadata } from "next";
import { ProductionForm } from "@/components/production-form";
import { SetupRequired } from "@/components/setup-required";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { getActiveUnitId, getUserUnits } from "@/lib/units";

export const metadata: Metadata = { title: "Lançar produção" };

export default async function ProductionPage() {
  if (!isSupabaseConfigured()) return <div className="grid gap-6"><header><h1 className="page-title">Lançar produção</h1><p className="page-description">Registre a produção diária por serviço.</p></header><SetupRequired /></div>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [profile, services, sectors, links, collaborators, collaboratorUnits, indicators] = await Promise.all([
    supabase.from("profiles").select("user_id,full_name,service_id,role").eq("user_id", user!.id).single(),
    supabase.from("services").select("id,code,name").eq("active", true).order("name"),
    supabase.from("sectors").select("id,unit_id,code,name,context").eq("active", true).order("name"),
    supabase.from("service_sectors").select("service_id,sector_id"),
    supabase.from("collaborators").select("id,canonical_name,service_id").eq("active", true).order("canonical_name"),
    supabase.from("collaborator_units").select("collaborator_id,unit_id"),
    supabase.from("indicators").select("id,service_id,code,name,context,kind,unit,display_order,derived").eq("active", true).eq("derived", false).order("display_order"),
  ]);
  const units = await getUserUnits(supabase, profile.data as Profile);
  const activeUnitId = await getActiveUnitId(units, profile.data as Profile);
  return <div className="grid gap-6"><header><h1 className="page-title">Lançar produção</h1><p className="page-description">Campos padronizados evitam duplicidades e mantêm os indicadores confiáveis.</p></header><ProductionForm units={units} defaultUnitId={activeUnitId ?? units[0]?.id} services={services.data ?? []} sectors={sectors.data ?? []} serviceSectors={links.data ?? []} collaborators={collaborators.data ?? []} collaboratorUnits={collaboratorUnits.data ?? []} indicators={indicators.data ?? []} defaultServiceId={profile.data?.service_id ?? services.data?.[0]?.id} lockService={profile.data?.role === "colaborador"} /></div>;
}
