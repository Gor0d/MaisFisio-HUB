import type { Metadata } from "next";
import { differenceInCalendarDays, subDays } from "date-fns";
import { DashboardView } from "@/components/dashboard-view";
import { SetupRequired } from "@/components/setup-required";
import { fetchAllRows } from "@/lib/supabase/pagination";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSession } from "@/lib/session";

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

  // Reaproveita o que o layout já buscou nesta mesma requisição (React cache()).
  const { supabase, activeUnitId } = await getSession();
  const serviceFilter = filters.servico || null;
  const sectorFilter = filters.setor || null;

  let sectorsQuery = supabase.from("sectors").select("id,name").eq("active", true).order("name");
  if (activeUnitId) sectorsQuery = sectorsQuery.eq("unit_id", activeUnitId);

  // Nenhuma destas consultas depende do resultado de outra — só de filtros já
  // conhecidos (activeUnitId/serviceFilter/sectorFilter/datas). Rodar tudo em
  // paralelo em vez de sequencial evita somar a latência de cada uma (a
  // função Vercel roda na mesma região do Supabase — gru1 — mas mesmo assim
  // 6 idas e voltas em série custam bem mais que 6 em paralelo).
  const [totals, previousTotals, services, sectors, metrics, scales] = await Promise.all([
    // Totais por indicador vêm agregados do banco (soma/média/derivada
    // conforme o tipo — supabase/migrations/202607210010): sem corte de
    // linhas, porque o resultado tem no máximo 1 linha por indicador ativo.
    supabase.rpc("production_metrics_totals", { p_start: start, p_end: end, p_unit: activeUnitId, p_service: serviceFilter, p_sector: sectorFilter }),
    supabase.rpc("production_metrics_totals", { p_start: prevStart, p_end: prevEnd, p_unit: activeUnitId, p_service: serviceFilter, p_sector: sectorFilter }),
    supabase.from("services").select("id,code,name").eq("active", true).order("name"),
    sectorsQuery,
    // Linhas brutas ainda alimentam o gráfico de tendência e as quebras por
    // turno/setor/tipo (não dá para tirar isso de um agregado só por
    // indicador). Paginado em vez de .limit() fixo: nunca corta em silêncio.
    fetchAllRows<Record<string, unknown>>((from, to) => {
      let q = supabase.from("production_metrics").select(METRIC_COLUMNS).gte("record_date", start).lte("record_date", end).order("record_date");
      if (activeUnitId) q = q.eq("unit_id", activeUnitId);
      if (serviceFilter) q = q.eq("service_id", serviceFilter);
      if (sectorFilter) q = q.eq("sector_id", sectorFilter);
      return q.range(from, to);
    }),
    fetchAllRows<Record<string, unknown>>((from, to) => {
      let q = supabase.from("scale_assessment_results").select("scale_type,assessment_date,moment,total,entry_total,improved,sector_id,unit_id").gte("assessment_date", start).lte("assessment_date", end).eq("complete", true);
      if (activeUnitId) q = q.eq("unit_id", activeUnitId);
      if (sectorFilter) q = q.eq("sector_id", sectorFilter);
      return q.range(from, to);
    }),
  ]);

  return <DashboardView totals={totals.data ?? []} previousTotals={previousTotals.data ?? []} metrics={metrics as never} scales={scales as never} services={services.data ?? []} sectors={sectors.data ?? []} filters={{ ...filters, de: start, ate: end }} />;
}
