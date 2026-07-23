import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Unit } from "@/lib/types";
import { getActiveUnitId, getUserUnits } from "@/lib/units";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let profile: Profile = { user_id: "setup", full_name: "Configuração", role: "admin", service_id: null };
  let units: Unit[] = [];
  let activeUnitId: string | null = null;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const { data } = await supabase.from("profiles").select("user_id, full_name, role, service_id, active").eq("user_id", user.id).single();
    // Sem signOut, a sessão permanece válida e o middleware manda o usuário
    // de volta para /dashboard assim que ele chega em /login — loop infinito.
    if (data && !data.active) { await supabase.auth.signOut(); redirect("/login?erro=inativo"); }
    profile = (data ?? { user_id: user.id, full_name: user.email?.split("@")[0] ?? "Usuário", role: "colaborador", service_id: null }) as Profile;
    units = await getUserUnits(supabase, profile);
    activeUnitId = await getActiveUnitId(units, profile);
  }
  return <AppShell profile={profile} units={units} activeUnitId={activeUnitId}><ServiceWorkerRegister />{children}</AppShell>;
}
