import type { Metadata } from "next";
import { startOfMonth } from "date-fns";
import { ReportsView } from "@/components/reports-view";
import { SetupRequired } from "@/components/setup-required";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Relatórios" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  if (!isSupabaseConfigured()) return <div className="grid gap-6"><header><h1 className="page-title">Relatórios</h1><p className="page-description">Consolidados mensais para gestão.</p></header><SetupRequired /></div>;
  const { mes } = await searchParams; const month = mes ?? startOfMonth(new Date()).toISOString().slice(0, 7); const start = `${month}-01`; const end = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).toISOString().slice(0, 10);
  const supabase = await createClient();
  const [metrics, scales] = await Promise.all([
    supabase.from("production_metrics").select("indicator_name,value,kind").gte("record_date", start).lte("record_date", end).limit(20000),
    supabase.from("scale_assessment_results").select("scale_type,moment,total,improved").gte("assessment_date", start).lte("assessment_date", end).eq("complete", true).limit(20000),
  ]);
  return <ReportsView month={month} metrics={metrics.data ?? []} scales={scales.data ?? []} />;
}
