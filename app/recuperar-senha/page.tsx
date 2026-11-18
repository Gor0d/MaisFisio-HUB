import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { RecoverPasswordForm } from "@/components/recover-password-form";
import { SetupRequired } from "@/components/setup-required";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function RecoverPasswordPage() {
  const configured = isSupabaseConfigured();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Image src="/logo-maisfisio.png" alt="MaisFisio" width={703} height={467} priority className="h-auto w-36" /></div>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Recuperar senha</CardTitle>
            <CardDescription>Informe o e-mail da sua conta. Enviaremos um link para você definir uma nova senha.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {!configured && <SetupRequired />}
            {/* Enquanto não houver SMTP institucional, o e-mail pode não chegar
                (ver docs/plano-migracao-vps.md); o caminho garantido é o gestor. */}
            <Alert className="flex gap-2 border-blue-200 bg-blue-50 text-blue-900"><KeyRound className="mt-0.5 size-4 shrink-0" /><span>Mais rápido: peça ao gestor da sua unidade uma <strong>nova senha provisória</strong>. No próximo acesso você cria a sua.</span></Alert>
            <RecoverPasswordForm disabled={!configured} />
            <Link href="/login" className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-primary hover:underline"><ArrowLeft className="size-4" />Voltar para o login</Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
