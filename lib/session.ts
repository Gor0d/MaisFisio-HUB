import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getActiveUnitId, getUserUnits } from "@/lib/units";
import type { Profile, Unit } from "@/lib/types";

export type Session = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string | null;
  profile: Profile & { active?: boolean };
  units: Unit[];
  activeUnitId: string | null;
};

// React cache(): memoiza por requisição. O layout protegido e a página filha
// chamavam auth.getUser() + profiles + getUserUnits() + getActiveUnitId()
// cada um por conta própria — dobrando 4 idas ao Supabase em toda navegação,
// já que layout e página rodam na mesma requisição. Com cache(), a segunda
// chamada (da página) reaproveita o resultado que o layout já buscou.
export const getSession = cache(async (): Promise<Session> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, userId: null, profile: { user_id: "", full_name: "", role: "colaborador", service_id: null }, units: [], activeUnitId: null };

  const { data } = await supabase.from("profiles").select("user_id, full_name, role, service_id, active").eq("user_id", user.id).single();
  const profile = (data ?? { user_id: user.id, full_name: user.email?.split("@")[0] ?? "Usuário", role: "colaborador" as const, service_id: null, active: true }) as Profile & { active?: boolean };

  const units = await getUserUnits(supabase, profile);
  const activeUnitId = await getActiveUnitId(units, profile);
  return { supabase, userId: user.id, profile, units, activeUnitId };
});
