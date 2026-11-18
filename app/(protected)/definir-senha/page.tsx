import type { Metadata } from "next";
import { SetPasswordScreen } from "@/components/set-password-screen";
import { getSession } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Definir senha" };

export default async function SetPasswordPage() {
  const provisional = isSupabaseConfigured() ? (await getSession()).mustChangePassword : false;
  return <SetPasswordScreen provisional={provisional} />;
}
