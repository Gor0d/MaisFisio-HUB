import type { Metadata } from "next";
import { PasswordForm } from "@/components/password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Definir senha" };

export default function SetPasswordPage() {
  return <div className="mx-auto grid max-w-lg gap-6 pt-4 md:pt-12"><header><h1 className="page-title">Defina sua senha</h1><p className="page-description">Conclua a ativação da sua conta institucional.</p></header><Card><CardHeader><CardTitle>Nova senha</CardTitle><CardDescription>Use pelo menos 8 caracteres e não compartilhe sua credencial.</CardDescription></CardHeader><CardContent><PasswordForm /></CardContent></Card></div>;
}
