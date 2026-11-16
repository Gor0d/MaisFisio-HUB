import type { Metadata } from "next";
import { addMonths, endOfMonth, format, parse, startOfMonth, subMonths } from "date-fns";
import type { Grouped } from "@/components/dashboard-view";
import { MonthlyPanel } from "@/components/monthly-panel";
import { SetupRequired } from "@/components/setup-required";
import { getSession } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { SERVICE_ORDER } from "@/lib/service-themes";

export const metadata: Metadata = { title: "Painel mensal" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

// Painel de B.I. para a reunião mensal: 12 meses de cada indicador do serviço,
// já agregados pelo banco (production_metrics_grouped, por mês), com o mês de
// referência em destaque, variação contra o mês anterior e situação da meta.
export default async function MonthlyPanelPage({ searchParams }: { searchParams: Promise<{ servico?: string; mes?: string }> }) {
  if (!isSupabaseConfigured()) return <div className="grid gap-6"><header><h1 className="page-title">Painel mensal</h1></header><SetupRequired /></div>;

  const params = await searchParams;
  const { supabase, units, activeUnitId, profile } = await getSession();

  const { data: services } = await supabase.from("services").select("id,code,name").eq("active", true);
  const ordered = SERVICE_ORDER.map((code) => services?.find((s) => s.code === code)).filter((s): s is NonNullable<typeof s> => Boolean(s));
  const service = ordered.find((s) => s.id === params.servico && UUID_PATTERN.test(params.servico ?? ""))
    ?? ordered.find((s) => s.id === profile.service_id)
    ?? ordered[0];

  // Mês de referência: o pedido ou, por padrão, o último mês com lançamento
  // do serviço na unidade (o mês corrente costuma estar incompleto).
  let month = MONTH_PATTERN.test(params.mes ?? "") ? params.mes! : null;
  if (!month && service) {
    let latest = supabase.from("production_records").select("record_date").eq("service_id", service.id).order("record_date", { ascending: false }).limit(1);
    if (activeUnitId) latest = latest.eq("unit_id", activeUnitId);
    const { data } = await latest.maybeSingle();
    month = data?.record_date?.slice(0, 7) ?? format(new Date(), "yyyy-MM");
  }
  const reference = startOfMonth(parse(`${month ?? format(new Date(), "yyyy-MM")}-01`, "yyyy-MM-dd", new Date()));
  const start = format(subMonths(reference, 11), "yyyy-MM-dd");
  const end = format(endOfMonth(reference), "yyyy-MM-dd");
  const months = Array.from({ length: 12 }, (_, i) => format(addMonths(subMonths(reference, 11), i), "yyyy-MM"));

  let targetsQuery = supabase
    .from("indicator_targets")
    .select("indicator_id,unit_id,sector_id,target_value,comparison,valid_from,valid_until")
    .lte("valid_from", end)
    .or(`valid_until.is.null,valid_until.gte.${end}`)
    .is("sector_id", null);
  targetsQuery = activeUnitId ? targetsQuery.or(`unit_id.is.null,unit_id.eq.${activeUnitId}`) : targetsQuery.is("unit_id", null);

  const [grouped, indicators, targets] = await Promise.all([
    service
      ? supabase.rpc("production_metrics_grouped", { p_start: start, p_end: end, p_unit: activeUnitId, p_service: service.id, p_sector: null, p_shift: null, p_collaborator: null, p_group: "month", p_indicator: null })
      : Promise.resolve({ data: [] }),
    service
      ? supabase.from("indicators").select("id,code,name,kind,derived,context").eq("service_id", service.id).eq("active", true).neq("kind", "texto").order("context").order("name")
      : Promise.resolve({ data: [] }),
    targetsQuery,
  ]);

  return (
    <MonthlyPanel
      services={ordered}
      service={service ?? null}
      unitName={units.find((u) => u.id === activeUnitId)?.name ?? "Todas as unidades"}
      activeUnitId={activeUnitId}
      month={format(reference, "yyyy-MM")}
      months={months}
      rows={(grouped.data ?? []) as Grouped[]}
      indicators={indicators.data ?? []}
      targets={targets.data ?? []}
    />
  );
}
