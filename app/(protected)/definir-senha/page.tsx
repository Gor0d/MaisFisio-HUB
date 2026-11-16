import type { Metadata } from "next";
import { PasswordForm } from "@/components/password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { mustChangePassword } from "@/lib/provisional-password";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Definir senha" };

export default async function SetPasswordPage() {
  let provisional = false;
  if (isSupabaseConfigured()) {
    const { data: { user } } = await (await createClient()).auth.getUser();
    provisional = mustChangePassword(user);
  }
  return <div className="mx-auto grid max-w-lg gap-6 pt-4 md:pt-12"><header><h1 className="page-title">{provisional ? "Crie sua senha pessoal" : "Defina sua senha"}</h1><p className="page-description">{provisional ? "Você entrou com uma senha provisória. Para usar o sistema, troque-a por uma senha que só você conheça." : "Vale tanto para ativar seu acesso quanto para redefinir uma senha esquecida."}</p></header><Card><CardHeader><CardTitle>Nova senha</CardTitle><CardDescription>Use pelo menos 8 caracteres e não compartilhe sua credencial.</CardDescription></CardHeader><CardContent><PasswordForm /></CardContent></Card></div>;
}
