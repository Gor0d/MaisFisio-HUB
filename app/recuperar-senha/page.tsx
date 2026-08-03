import type { Metadata } from "next";
import Link from "next/link";
import { RecoverPasswordForm } from "@/components/recover-password-form";
import { SetupRequired } from "@/components/setup-required";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function RecoverPasswordPage() {
  const configured = isSupabaseConfigured();
  return (
    <main className="grid min-h-screen place-items-center p-5 sm:p-10">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Recuperar senha</CardTitle>
            <CardDescription>Informe o e-mail da sua conta institucional. Enviaremos um link para você definir uma nova senha.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {!configured && <SetupRequired />}
            <RecoverPasswordForm disabled={!configured} />
            <p className="text-center text-sm text-muted-foreground"><Link href="/login" className="font-medium text-primary hover:underline">Voltar para o login</Link></p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
