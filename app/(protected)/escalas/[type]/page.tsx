import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScaleForm } from "@/components/scale-form";
import { SetupRequired } from "@/components/setup-required";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { ScaleType } from "@/lib/types";

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
  const [items, sectors, collaborators] = await Promise.all([
    supabase.from("scale_items").select("id,scale_type,code,name,display_order,max_points,scale_item_options(id,item_id,label,points,display_order)").eq("scale_type", scaleType).order("display_order").order("display_order", { referencedTable: "scale_item_options" }),
    supabase.from("sectors").select("id,code,name,context").eq("active", true).order("name"),
    supabase.from("collaborators").select("id,canonical_name,service_id").eq("active", true).order("canonical_name"),
  ]);
  return <div className="grid gap-6"><header><h1 className="page-title">{names[scaleType]}</h1><p className="page-description">Preencha todos os itens; o total será calculado automaticamente.</p></header><ScaleForm type={scaleType} items={(items.data ?? []) as never} sectors={sectors.data ?? []} collaborators={collaborators.data ?? []} /></div>;
}
