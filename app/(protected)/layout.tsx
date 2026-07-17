import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  let profile: Profile = { user_id: "setup", full_name: "Configuração", role: "admin", service_id: null };
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const { data } = await supabase.from("profiles").select("user_id, full_name, role, service_id, active").eq("user_id", user.id).single();
    if (data && !data.active) redirect("/login?erro=inativo");
    profile = (data ?? { user_id: user.id, full_name: user.email?.split("@")[0] ?? "Usuário", role: "colaborador", service_id: null }) as Profile;
  }
  return <AppShell profile={profile}><ServiceWorkerRegister />{children}</AppShell>;
}
