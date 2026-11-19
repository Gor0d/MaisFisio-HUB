import type { Metadata } from "next";
import { ScaleBiView } from "@/components/scale-bi-view";
import { SetupRequired } from "@/components/setup-required";
import { getSession } from "@/lib/session";
import { isScaleType, type ScaleBi, type ScaleQuality } from "@/lib/scale-bi";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { ScaleType } from "@/lib/types";
import { todayISO } from "@/lib/utils";

export const metadata: Metadata = { title: "B.I. das escalas" };

const iso = (value?: string) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);

export default async function ScaleBiPage({ searchParams }: { searchParams: Promise<{ escala?: string; de?: string; ate?: string; setor?: string }> }) {
  if (!isSupabaseConfigured()) return <div className="grid gap-6"><header><h1 className="page-title">B.I. das escalas</h1><p className="page-description">Indicadores das escalas clínicas.</p></header><SetupRequired /></div>;
  const params = await searchParams;
  const scale: ScaleType = isScaleType(params.escala) ? params.escala : "barthel";
  const today = todayISO();
  const ate = iso(params.ate) ?? today;
  const de = iso(params.de) ?? `${ate.slice(0, 4)}-01-01`;
  const setor = params.setor && /^[0-9a-f-]{36}$/i.test(params.setor) ? params.setor : null;

  const { supabase, units, activeUnitId, profile } = await getSession();
  // Qualidade dos registros e correção: só administrador e matriz.
  const isAdmin = profile.role === "admin" || profile.role === "super_admin";
  const [bi, sectors, quality, collaborators, collaboratorUnits] = await Promise.all([
    supabase.rpc("scale_bi", { p_scale: scale, p_start: de, p_end: ate, p_unit: activeUnitId, p_sector: setor }),
    supabase.from("sectors").select("id,name,unit_id").eq("active", true).order("name"),
    isAdmin ? supabase.rpc("scale_data_quality", { p_scale: scale, p_start: de, p_end: ate, p_unit: activeUnitId, p_sector: setor }) : Promise.resolve({ data: null }),
    isAdmin ? supabase.from("collaborators").select("id,canonical_name").eq("active", true).order("canonical_name") : Promise.resolve({ data: [] }),
    isAdmin ? supabase.from("collaborator_units").select("collaborator_id,unit_id") : Promise.resolve({ data: [] }),
  ]);
  const unitCollaborators = new Set((collaboratorUnits.data ?? []).filter((l) => !activeUnitId || l.unit_id === activeUnitId).map((l) => l.collaborator_id));
  const unitName = units.find((u) => u.id === activeUnitId)?.name ?? "Todas as unidades";
  return <ScaleBiView
    scale={scale}
    data={(bi.data ?? null) as ScaleBi | null}
    error={bi.error?.message ?? null}
    sectors={(sectors.data ?? []).filter((s) => !activeUnitId || s.unit_id === activeUnitId).map(({ id, name }) => ({ id, name }))}
    filters={{ de, ate, setor }}
    unitName={unitName}
    today={today}
    quality={(quality.data ?? null) as ScaleQuality | null}
    collaborators={(collaborators.data ?? []).filter((c) => unitCollaborators.has(c.id)).map((c) => ({ id: c.id, name: c.canonical_name }))}
  />;
}
