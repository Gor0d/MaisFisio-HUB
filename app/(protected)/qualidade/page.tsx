import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { QualityView } from "@/components/quality-view";
import { SetupRequired } from "@/components/setup-required";
import { isValidMonth, monthRange, previousMonth, previousOf } from "@/lib/quality";
import { getSession } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Qualidade (Interact)" };

export default async function QualityPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  if (!isSupabaseConfigured()) return <div className="grid gap-6"><header><h1 className="page-title">Qualidade (Interact)</h1><p className="page-description">Indicadores mensais calculados para o portal de qualidade.</p></header><SetupRequired /></div>;
  const { supabase, profile, units, activeUnitId } = await getSession();
  // O cálculo cruza serviços; só admin da unidade e matriz enxergam o consolidado
  // completo (a RLS de coordenador/colaborador é limitada ao próprio serviço).
  if (profile.role !== "super_admin" && profile.role !== "admin") redirect("/dashboard");

  const { mes } = await searchParams;
  const month = isValidMonth(mes) ? mes : previousMonth();
  const { start, end } = monthRange(month);
  const previous = monthRange(previousOf(month));

  let qualityQuery = supabase.from("quality_indicators")
    .select("id,unit_id,service_id,name,interact_code,numerator_ids,denominator_ids,sector_ids,multiplier,result_unit,decimals,target_value,target_comparison,notes,active")
    .order("name");
  if (activeUnitId) qualityQuery = qualityQuery.eq("unit_id", activeUnitId);

  const [quality, current, before, indicators, services, sectors] = await Promise.all([
    qualityQuery,
    supabase.rpc("quality_indicator_results", { p_start: start, p_end: end, p_unit: activeUnitId }),
    supabase.rpc("quality_indicator_results", { p_start: previous.start, p_end: previous.end, p_unit: activeUnitId }),
    supabase.from("indicators").select("id,name,service_id,context").eq("kind", "contagem").eq("derived", false).eq("active", true).order("name"),
    supabase.from("services").select("id,name").eq("active", true).order("name"),
    supabase.from("sectors").select("id,unit_id,name,context").eq("active", true).order("name"),
  ]);

  // Vários indicadores têm o mesmo nome ("Atendimentos Realizados") em serviços e
  // contextos diferentes; o rótulo traz os dois para a fórmula não ficar ambígua.
  const serviceNames = new Map((services.data ?? []).map((service) => [service.id, service.name]));
  const labeledIndicators = (indicators.data ?? []).map((indicator) => ({
    ...indicator,
    name: `${serviceNames.get(indicator.service_id) ?? "Serviço"} · ${indicator.name}${indicator.context !== "geral" ? ` (${indicator.context})` : ""}`,
  }));

  return <QualityView
    month={month}
    units={units}
    activeUnitId={activeUnitId}
    services={services.data ?? []}
    indicators={labeledIndicators}
    sectors={sectors.data ?? []}
    quality={(quality.data ?? []) as never}
    results={(current.data ?? []) as never}
    previousResults={(before.data ?? []) as never}
  />;
}
