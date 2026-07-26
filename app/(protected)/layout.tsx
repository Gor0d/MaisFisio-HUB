import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { getSession } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Profile, Unit } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let profile: Profile = { user_id: "setup", full_name: "Configuração", role: "admin", service_id: null };
  let units: Unit[] = [];
  let activeUnitId: string | null = null;
  if (isSupabaseConfigured()) {
    const session = await getSession();
    if (!session.userId) redirect("/login");
    // Sem signOut, a sessão permanece válida e o middleware manda o usuário
    // de volta para /dashboard assim que ele chega em /login — loop infinito.
    if (session.profile.active === false) { await session.supabase.auth.signOut(); redirect("/login?erro=inativo"); }
    profile = session.profile;
    units = session.units;
    activeUnitId = session.activeUnitId;
  }
  return <AppShell profile={profile} units={units} activeUnitId={activeUnitId}><ServiceWorkerRegister />{children}</AppShell>;
}
