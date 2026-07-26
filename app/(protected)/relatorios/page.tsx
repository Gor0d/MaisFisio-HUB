import type { Metadata } from "next";
import { startOfMonth } from "date-fns";
import { ReportsView } from "@/components/reports-view";
import { SetupRequired } from "@/components/setup-required";
import { fetchAllRows } from "@/lib/supabase/pagination";
import { getSession } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Relatórios" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  if (!isSupabaseConfigured()) return <div className="grid gap-6"><header><h1 className="page-title">Relatórios</h1><p className="page-description">Consolidados mensais para gestão.</p></header><SetupRequired /></div>;
  const { mes } = await searchParams; const month = mes ?? startOfMonth(new Date()).toISOString().slice(0, 7); const start = `${month}-01`; const end = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).toISOString().slice(0, 10);
  // Reaproveita usuário/perfil/unidades já buscados pelo layout (React cache()).
  const { supabase, activeUnitId } = await getSession();

  // Totais agregados no banco (soma/média/derivada por tipo de indicador) —
  // sem risco de corte e sem somar percentuais como se fossem contagem.
  // Roda junto com a busca das escalas (nenhuma depende da outra).
  const [totals, scales] = await Promise.all([
    supabase.rpc("production_metrics_totals", { p_start: start, p_end: end, p_unit: activeUnitId, p_service: null, p_sector: null }),
    fetchAllRows<Record<string, unknown>>((from, to) => {
      let q = supabase.from("scale_assessment_results").select("scale_type,moment,total,improved").gte("assessment_date", start).lte("assessment_date", end).eq("complete", true);
      if (activeUnitId) q = q.eq("unit_id", activeUnitId);
      return q.range(from, to);
    }),
  ]);

  return <ReportsView month={month} totals={totals.data ?? []} scales={scales as never} />;
}
