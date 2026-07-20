import type { Metadata } from "next";
import { differenceInCalendarDays, subDays } from "date-fns";
import { DashboardView } from "@/components/dashboard-view";
import { SetupRequired } from "@/components/setup-required";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { getActiveUnitId, getUserUnits } from "@/lib/units";

export const metadata: Metadata = { title: "Visão geral" };

const METRIC_COLUMNS = "record_date,indicator_code,indicator_name,kind,value,service_id,sector_id,unit_id,shift,sector_type";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!isSupabaseConfigured()) return <div className="grid gap-6"><header><h1 className="page-title">Visão geral</h1><p className="page-description">Acompanhe produção e evolução clínica.</p></header><SetupRequired /></div>;

  const filters = await searchParams;
  const end = filters.ate ?? new Date().toISOString().slice(0, 10);
  const start = filters.de ?? subDays(new Date(), 29).toISOString().slice(0, 10);
  // Período imediatamente anterior, de mesma duração, para os deltas dos KPIs.
  const spanDays = Math.max(differenceInCalendarDays(new Date(`${end}T00:00:00Z`), new Date(`${start}T00:00:00Z`)), 0) + 1;
  const prevEnd = subDays(new Date(`${start}T00:00:00Z`), 1).toISOString().slice(0, 10);
  const prevStart = subDays(new Date(`${start}T00:00:00Z`), spanDays).toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileRow } = await supabase.from("profiles").select("user_id,full_name,role,service_id").eq("user_id", user!.id).single();
  const units = await getUserUnits(supabase, profileRow as Profile);
  // null = visão consolidada de todas as unidades (apenas super_admin)
  const activeUnitId = await getActiveUnitId(units, profileRow as Profile);

  let metricsQuery = supabase.from("production_metrics").select(METRIC_COLUMNS).gte("record_date", start).lte("record_date", end).order("record_date");
  let prevQuery = supabase.from("production_metrics").select("indicator_code,value,kind").gte("record_date", prevStart).lte("record_date", prevEnd);
  if (activeUnitId) { metricsQuery = metricsQuery.eq("unit_id", activeUnitId); prevQuery = prevQuery.eq("unit_id", activeUnitId); }
  if (filters.servico) { metricsQuery = metricsQuery.eq("service_id", filters.servico); prevQuery = prevQuery.eq("service_id", filters.servico); }
  if (filters.setor) { metricsQuery = metricsQuery.eq("sector_id", filters.setor); prevQuery = prevQuery.eq("sector_id", filters.setor); }

  let scalesQuery = supabase.from("scale_assessment_results").select("scale_type,assessment_date,moment,total,entry_total,improved,sector_id,unit_id").gte("assessment_date", start).lte("assessment_date", end).eq("complete", true);
  if (activeUnitId) scalesQuery = scalesQuery.eq("unit_id", activeUnitId);
  if (filters.setor) scalesQuery = scalesQuery.eq("sector_id", filters.setor);

  let sectorsQuery = supabase.from("sectors").select("id,name").eq("active", true).order("name");
  if (activeUnitId) sectorsQuery = sectorsQuery.eq("unit_id", activeUnitId);

  const [metrics, previous, scales, services, sectors] = await Promise.all([
    metricsQuery.limit(20000), prevQuery.limit(20000), scalesQuery.limit(10000),
    supabase.from("services").select("id,code,name").eq("active", true).order("name"),
    sectorsQuery,
  ]);

  return <DashboardView metrics={metrics.data ?? []} previous={previous.data ?? []} scales={scales.data ?? []} services={services.data ?? []} sectors={sectors.data ?? []} filters={{ ...filters, de: start, ate: end }} />;
}
