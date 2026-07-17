import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, Unit } from "@/lib/types";

export const ACTIVE_UNIT_COOKIE = "mf-unit";
export const ALL_UNITS = "all";

// super_admin (matriz) enxerga todas as unidades; demais papéis apenas as
// unidades vinculadas em profile_units.
export async function getUserUnits(supabase: SupabaseClient, profile: Profile): Promise<Unit[]> {
  if (profile.role === "super_admin") {
    const { data } = await supabase.from("units").select("id,code,name").eq("active", true).order("name");
    return data ?? [];
  }
  const { data } = await supabase.from("profile_units").select("units(id,code,name)").eq("user_id", profile.user_id);
  return (data ?? []).flatMap((x) => (x.units ? [x.units as unknown as Unit] : [])).sort((a, b) => a.name.localeCompare(b.name));
}

// Unidade ativa da sessão: cookie válido → cookie; senão a primeira unidade.
// "all" (visão consolidada) é permitido apenas para super_admin.
export async function getActiveUnitId(units: Unit[], profile: Profile): Promise<string | null> {
  const stored = (await cookies()).get(ACTIVE_UNIT_COOKIE)?.value;
  if (stored === ALL_UNITS && profile.role === "super_admin") return null;
  if (stored && units.some((x) => x.id === stored)) return stored;
  return units[0]?.id ?? null;
}
