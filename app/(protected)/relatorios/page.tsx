import type { Metadata } from "next";
import { startOfMonth } from "date-fns";
import { ReportsView } from "@/components/reports-view";
import { SetupRequired } from "@/components/setup-required";
import { fetchAllRows } from "@/lib/supabase/pagination";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { getActiveUnitId, getUserUnits } from "@/lib/units";

export const metadata: Metadata = { title: "Relatórios" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  if (!isSupabaseConfigured()) return <div className="grid gap-6"><header><h1 className="page-title">Relatórios</h1><p className="page-description">Consolidados mensais para gestão.</p></header><SetupRequired /></div>;
  const { mes } = await searchParams; const month = mes ?? startOfMonth(new Date()).toISOString().slice(0, 7); const start = `${month}-01`; const end = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).toISOString().slice(0, 10);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profileRow } = await supabase.from("profiles").select("user_id,full_name,role,service_id").eq("user_id", user!.id).single();
  const units = await getUserUnits(supabase, profileRow as Profile);
  const activeUnitId = await getActiveUnitId(units, profileRow as Profile);

  // Totais agregados no banco (soma/média/derivada por tipo de indicador) —
  // sem risco de corte e sem somar percentuais como se fossem contagem.
  const totalsQuery = supabase.rpc("production_metrics_totals", { p_start: start, p_end: end, p_unit: activeUnitId, p_service: null, p_sector: null });
  const scales = await fetchAllRows<Record<string, unknown>>((from, to) => {
    let q = supabase.from("scale_assessment_results").select("scale_type,moment,total,improved").gte("assessment_date", start).lte("assessment_date", end).eq("complete", true);
    if (activeUnitId) q = q.eq("unit_id", activeUnitId);
    return q.range(from, to);
  });
  const totals = await totalsQuery;

  return <ReportsView month={month} totals={totals.data ?? []} scales={scales as never} />;
}
