import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScaleForm } from "@/components/scale-form";
import { SetupRequired } from "@/components/setup-required";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Profile, ScaleType } from "@/lib/types";
import { getActiveUnitId, getUserUnits } from "@/lib/units";

const valid = ["barthel", "mrc", "melhoria_uti"] as const;
const names: Record<ScaleType, string> = { barthel: "Índice de Barthel", mrc: "Escala MRC", melhoria_uti: "Melhoria Funcional da UTI" };

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }): Promise<Metadata> {
  const { type } = await params; return { title: names[type as ScaleType] ?? "Escala" };
}

export default async function ScalePage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!valid.includes(type as ScaleType)) notFound();
  const scaleType = type as ScaleType;
  if (!isSupabaseConfigured()) return <div className="grid gap-6"><header><h1 className="page-title">{names[scaleType]}</h1><p className="page-description">Nova avaliação clínica.</p></header><SetupRequired /></div>;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [profile, items, sectors, collaborators, collaboratorUnits] = await Promise.all([
    supabase.from("profiles").select("user_id,full_name,role,service_id").eq("user_id", user!.id).single(),
    supabase.from("scale_items").select("id,scale_type,code,name,display_order,max_points,scale_item_options(id,item_id,label,points,display_order)").eq("scale_type", scaleType).order("display_order").order("display_order", { referencedTable: "scale_item_options" }),
    supabase.from("sectors").select("id,unit_id,code,name,context").eq("active", true).order("name"),
    supabase.from("collaborators").select("id,canonical_name,service_id").eq("active", true).order("canonical_name"),
    supabase.from("collaborator_units").select("collaborator_id,unit_id"),
  ]);
  const units = await getUserUnits(supabase, profile.data as Profile);
  const activeUnitId = await getActiveUnitId(units, profile.data as Profile);
  return <div className="grid gap-6"><header><h1 className="page-title">{names[scaleType]}</h1><p className="page-description">Preencha todos os itens; o total será calculado automaticamente.</p></header><ScaleForm type={scaleType} units={units} defaultUnitId={activeUnitId ?? units[0]?.id} items={(items.data ?? []) as never} sectors={sectors.data ?? []} collaborators={collaborators.data ?? []} collaboratorUnits={collaboratorUnits.data ?? []} /></div>;
}
