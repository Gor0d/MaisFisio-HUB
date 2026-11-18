import { LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { PasswordForm } from "@/components/password-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SetPasswordScreen({ provisional }: { provisional: boolean }) {
  return <div className="mx-auto grid max-w-lg gap-6 px-4 pt-4 md:pt-12"><header><h1 className="page-title">{provisional ? "Crie sua senha pessoal" : "Defina sua senha"}</h1><p className="page-description">{provisional ? "Você entrou com uma senha provisória. Para usar o sistema, troque-a por uma senha que só você conheça." : "Vale tanto para ativar seu acesso quanto para redefinir uma senha esquecida."}</p></header><Card><CardHeader><CardTitle>Nova senha</CardTitle><CardDescription>Use pelo menos 8 caracteres e não compartilhe sua credencial.</CardDescription></CardHeader><CardContent><PasswordForm /></CardContent></Card>{provisional && <form action={logout}><Button type="submit" variant="ghost" className="w-full text-muted-foreground"><LogOut className="size-4" />Sair</Button></form>}</div>;
}
