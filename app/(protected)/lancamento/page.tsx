import type { Metadata } from "next";
import { ProductionForm } from "@/components/production-form";
import { SetupRequired } from "@/components/setup-required";
import { getSession } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Lançar produção" };

export default async function ProductionPage() {
  if (!isSupabaseConfigured()) return <div className="grid gap-6"><header><h1 className="page-title">Lançar produção</h1><p className="page-description">Registre a produção diária por serviço.</p></header><SetupRequired /></div>;
  // Reaproveita usuário/perfil/unidades já buscados pelo layout (React cache()).
  const { supabase, userId, profile, units, activeUnitId } = await getSession();
  const [services, sectors, links, collaborators, collaboratorUnits, indicators] = await Promise.all([
    supabase.from("services").select("id,code,name").eq("active", true).order("name"),
    supabase.from("sectors").select("id,unit_id,code,name,context").eq("active", true).order("name"),
    supabase.from("service_sectors").select("service_id,sector_id"),
    supabase.from("collaborators").select("id,canonical_name,service_id").eq("active", true).order("canonical_name"),
    supabase.from("collaborator_units").select("collaborator_id,unit_id"),
    supabase.from("indicators").select("id,service_id,code,name,context,kind,unit,display_order,derived").eq("active", true).eq("derived", false).order("display_order"),
  ]);
  return <div className="grid gap-6"><header><h1 className="page-title">Lançar produção</h1><p className="page-description">Campos padronizados evitam duplicidades e mantêm os indicadores confiáveis.</p></header><ProductionForm userId={userId!} units={units} defaultUnitId={activeUnitId ?? units[0]?.id} services={services.data ?? []} sectors={sectors.data ?? []} serviceSectors={links.data ?? []} collaborators={collaborators.data ?? []} collaboratorUnits={collaboratorUnits.data ?? []} indicators={indicators.data ?? []} defaultServiceId={profile.service_id ?? services.data?.[0]?.id} lockService={profile.role === "colaborador"} /></div>;
}
