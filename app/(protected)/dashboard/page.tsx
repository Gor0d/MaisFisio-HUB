import type { Metadata } from "next";
import { subDays } from "date-fns";
import { DashboardView } from "@/components/dashboard-view";
import { SetupRequired } from "@/components/setup-required";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Visão geral" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!isSupabaseConfigured()) return <div className="grid gap-6"><header><h1 className="page-title">Visão geral</h1><p className="page-description">Acompanhe produção e evolução clínica.</p></header><SetupRequired /></div>;

  const filters = await searchParams;
  const end = filters.ate ?? new Date().toISOString().slice(0, 10);
  const start = filters.de ?? subDays(new Date(), 29).toISOString().slice(0, 10);
  const supabase = await createClient();
  let metricsQuery = supabase.from("production_metrics").select("record_date,indicator_code,indicator_name,kind,value,service_id,sector_id").gte("record_date", start).lte("record_date", end).order("record_date");
  if (filters.servico) metricsQuery = metricsQuery.eq("service_id", filters.servico);
  if (filters.setor) metricsQuery = metricsQuery.eq("sector_id", filters.setor);

  let scalesQuery = supabase.from("scale_assessment_results").select("scale_type,assessment_date,moment,total,entry_total,improved,sector_id").gte("assessment_date", start).lte("assessment_date", end).eq("complete", true);
  if (filters.setor) scalesQuery = scalesQuery.eq("sector_id", filters.setor);

  const [metrics, scales, services, sectors] = await Promise.all([
    metricsQuery.limit(10000), scalesQuery.limit(10000),
    supabase.from("services").select("id,name").eq("active", true).order("name"),
    supabase.from("sectors").select("id,name").eq("active", true).order("name"),
  ]);

  return <DashboardView metrics={metrics.data ?? []} scales={scales.data ?? []} services={services.data ?? []} sectors={sectors.data ?? []} filters={{ ...filters, de: start, ate: end }} />;
}
