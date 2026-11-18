import type { Metadata } from "next";
import { startOfMonth } from "date-fns";
import { ReportsView } from "@/components/reports-view";
import { previousMonth } from "@/lib/report-model";
import { SetupRequired } from "@/components/setup-required";
import { fetchAllRows } from "@/lib/supabase/pagination";
import { getSession } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Relatórios" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  if (!isSupabaseConfigured()) return <div className="grid gap-6"><header><h1 className="page-title">Relatórios</h1><p className="page-description">Consolidados mensais para gestão.</p></header><SetupRequired /></div>;
  const { mes } = await searchParams; const month = mes ?? startOfMonth(new Date()).toISOString().slice(0, 7); const start = `${month}-01`; const end = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).toISOString().slice(0, 10);
  // Reaproveita usuário/perfil/unidades já buscados pelo layout (React cache()).
  const { supabase, units, activeUnitId } = await getSession();

  let targetsQuery = supabase
    .from("indicator_targets")
    .select("indicator_id,unit_id,sector_id,target_value,comparison,valid_from,valid_until")
    .lte("valid_from", end)
    .or(`valid_until.is.null,valid_until.gte.${end}`)
    .is("sector_id", null);
  targetsQuery = activeUnitId
    ? targetsQuery.or(`unit_id.is.null,unit_id.eq.${activeUnitId}`)
    : targetsQuery.is("unit_id", null);

  // Totais agregados no banco (soma/média/derivada por tipo de indicador) —
  // sem risco de corte e sem somar percentuais como se fossem contagem.
  // Roda junto com a busca das escalas (nenhuma depende da outra).
  const prev = previousMonth(month); const prevStart = `${prev}-01`; const prevEnd = new Date(Number(prev.slice(0, 4)), Number(prev.slice(5, 7)), 0).toISOString().slice(0, 10);
  const [totals, previousTotals, catalog, scales, targets] = await Promise.all([
    supabase.rpc("production_metrics_totals", { p_start: start, p_end: end, p_unit: activeUnitId, p_service: null, p_sector: null }),
    supabase.rpc("production_metrics_totals", { p_start: prevStart, p_end: prevEnd, p_unit: activeUnitId, p_service: null, p_sector: null }),
    supabase.from("indicators").select("id,display_order,context,services(code,name)"),
    fetchAllRows<Record<string, unknown>>((from, to) => {
      let q = supabase.from("scale_assessment_results").select("scale_type,moment,total,improved").gte("assessment_date", start).lte("assessment_date", end).eq("complete", true);
      if (activeUnitId) q = q.eq("unit_id", activeUnitId);
      return q.range(from, to);
    }),
    targetsQuery,
  ]);

  type CatalogRow = { id: string; display_order: number | null; context: string | null; services: { code: string; name: string } | { code: string; name: string }[] | null };
  const catalogItems = ((catalog.data ?? []) as CatalogRow[]).map((row) => { const service = Array.isArray(row.services) ? row.services[0] : row.services; return { id: row.id, display_order: row.display_order, context: row.context, service_code: service?.code ?? "outros", service_name: service?.name ?? "Outros" }; });
  return <ReportsView month={month} unitName={activeUnitId ? units.find((unit) => unit.id === activeUnitId)?.name ?? "Unidade ativa" : "Todas as unidades"} activeUnitId={activeUnitId} totals={totals.data ?? []} previousTotals={previousTotals.data ?? []} catalog={catalogItems} scales={scales as never} targets={targets.data ?? []} />;
}
