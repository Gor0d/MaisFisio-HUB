"use client";

import { useActionState } from "react";
import { LoaderCircle, LogIn } from "lucide-react";
import { login, type AuthState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthState = {};

export function LoginForm({ redirectTo, disabled }: { redirectTo?: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState(login, initialState);
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="redirect" value={redirectTo ?? "/dashboard"} />
      <div className="field">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="voce@maisfisio.com.br" required disabled={disabled} />
      </div>
      <div className="field">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" minLength={6} required disabled={disabled} />
      </div>
      {state.error && <Alert className="border-red-200 bg-red-50 text-red-800">{state.error}</Alert>}
      <Button type="submit" size="lg" disabled={pending || disabled}>
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <LogIn className="size-4" />}
        {pending ? "Entrando..." : "Entrar no sistema"}
      </Button>
    </form>
  );
}
