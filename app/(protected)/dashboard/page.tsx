import type { Metadata } from "next";
import { differenceInCalendarDays, subDays } from "date-fns";
import { DashboardView, type Grouped } from "@/components/dashboard-view";
import { SetupRequired } from "@/components/setup-required";
import { fetchAllRows } from "@/lib/supabase/pagination";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Visão geral" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const { supabase, units, activeUnitId } = await getSession();
  const serviceFilter = UUID_PATTERN.test(filters.servico ?? "") ? filters.servico! : null;
  const sectorFilter = UUID_PATTERN.test(filters.setor ?? "") ? filters.setor! : null;
  const shiftFilter = ["MANHÃ", "TARDE", "NOITE"].includes(filters.turno ?? "")
    ? filters.turno!
    : null;
  const collaboratorFilter = UUID_PATTERN.test(filters.colaborador ?? "")
    ? filters.colaborador!
    : null;

  let sectorsQuery = supabase.from("sectors").select("id,name").eq("active", true).order("name");
  if (activeUnitId) sectorsQuery = sectorsQuery.eq("unit_id", activeUnitId);

  let collaboratorsQuery = supabase
    .from("collaborators")
    .select("id,canonical_name,service_id,collaborator_units!inner(unit_id)")
    .eq("active", true)
    .order("canonical_name");
  if (activeUnitId) collaboratorsQuery = collaboratorsQuery.eq("collaborator_units.unit_id", activeUnitId);

  let targetsQuery = supabase
    .from("indicator_targets")
    .select("indicator_id,unit_id,sector_id,target_value,comparison,valid_from,valid_until")
    .lte("valid_from", end)
    .or(`valid_until.is.null,valid_until.gte.${end}`);
  targetsQuery = activeUnitId
    ? targetsQuery.or(`unit_id.is.null,unit_id.eq.${activeUnitId}`)
    : targetsQuery.is("unit_id", null);
  targetsQuery = sectorFilter
    ? targetsQuery.or(`sector_id.is.null,sector_id.eq.${sectorFilter}`)
    : targetsQuery.is("sector_id", null);

  // Nenhuma destas consultas depende do resultado de outra — só de filtros já
  // conhecidos (activeUnitId/serviceFilter/sectorFilter/datas). Rodar tudo em
  // paralelo em vez de sequencial evita somar a latência de cada uma (a
  // função Vercel roda na mesma região do Supabase — gru1 — mas mesmo assim
  // 6 idas e voltas em série custam bem mais que 6 em paralelo).
  // Tendência por dia em períodos de até ~3 meses; acima disso, por mês.
  const grain: "day" | "month" = spanDays > 92 ? "month" : "day";
  const grouped = (group: string) => supabase.rpc("production_metrics_grouped", { p_start: start, p_end: end, p_unit: activeUnitId, p_service: serviceFilter, p_sector: sectorFilter, p_shift: shiftFilter, p_collaborator: collaboratorFilter, p_group: group, p_indicator: null });
  const emptyGroup = Promise.resolve({ data: [] as Grouped[] });

  const [totals, previousTotals, services, sectors, collaborators, collaboratorNames, targets, trend, byShift, bySector, bySectorType, scales] = await Promise.all([
    // Totais por indicador vêm agregados do banco (soma/média/derivada
    // conforme o tipo — supabase/migrations/202607210010): sem corte de
    // linhas, porque o resultado tem no máximo 1 linha por indicador ativo.
    supabase.rpc("production_metrics_totals", { p_start: start, p_end: end, p_unit: activeUnitId, p_service: serviceFilter, p_sector: sectorFilter, p_shift: shiftFilter, p_collaborator: collaboratorFilter }),
    supabase.rpc("production_metrics_totals", { p_start: prevStart, p_end: prevEnd, p_unit: activeUnitId, p_service: serviceFilter, p_sector: sectorFilter, p_shift: shiftFilter, p_collaborator: collaboratorFilter }),
    supabase.from("services").select("id,code,name").eq("active", true).order("name"),
    sectorsQuery,
    collaboratorsQuery,
    // Nomes de todos (inclusive inativos, como os compostos da planilha) só
    // para rotular o histórico na exportação; o filtro usa apenas os ativos.
    supabase.from("collaborators").select("id,canonical_name"),
    targetsQuery,
    // Gráfico e quebras vêm agregados pelo banco (production_metrics_grouped).
    // Antes eram ~16 mil linhas brutas por mês (~197 mil em 12 meses) baixadas
    // só para somar no navegador; as linhas brutas agora só vão para a
    // exportação, sob demanda.
    grouped(grain),
    serviceFilter ? grouped("shift") : emptyGroup,
    serviceFilter ? grouped("sector") : emptyGroup,
    serviceFilter ? grouped("sector_type") : emptyGroup,
    shiftFilter ? Promise.resolve([]) : fetchAllRows<Record<string, unknown>>((from, to) => {
      let q = supabase.from("scale_assessment_results").select("scale_type,assessment_date,moment,total,entry_total,improved,sector_id,unit_id").gte("assessment_date", start).lte("assessment_date", end).eq("complete", true);
      if (activeUnitId) q = q.eq("unit_id", activeUnitId);
      if (sectorFilter) q = q.eq("sector_id", sectorFilter);
      if (collaboratorFilter) q = q.eq("collaborator_id", collaboratorFilter);
      return q.range(from, to);
    }),
  ]);

  return <DashboardView trend={(trend.data ?? []) as Grouped[]} grain={grain} breakdowns={{ shift: (byShift.data ?? []) as Grouped[], sector: (bySector.data ?? []) as Grouped[], sector_type: (bySectorType.data ?? []) as Grouped[] }} totals={totals.data ?? []} previousTotals={previousTotals.data ?? []} scales={scales as never} services={services.data ?? []} sectors={sectors.data ?? []} collaborators={collaborators.data ?? []} collaboratorNames={collaboratorNames.data ?? []} units={units} targets={targets.data ?? []} activeUnitId={activeUnitId} filters={{ ...filters, de: start, ate: end, servico: serviceFilter ?? undefined, setor: sectorFilter ?? undefined, turno: shiftFilter ?? undefined, colaborador: collaboratorFilter ?? undefined }} />;
}
