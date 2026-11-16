"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LoaderCircle, LogIn } from "lucide-react";
import Link from "next/link";
import { login, type AuthState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthState = {};

export function LoginForm({ redirectTo, disabled }: { redirectTo?: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState(login, initialState);
  const [showPassword, setShowPassword] = useState(false);
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="redirect" value={redirectTo ?? "/dashboard"} />
      <div className="field">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="voce@exemplo.com.br" className="h-11" required disabled={disabled} />
      </div>
      <div className="field">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Senha</Label>
          <Link href="/recuperar-senha" className="text-sm font-medium text-primary hover:underline">Esqueci minha senha</Link>
        </div>
        <div className="relative">
          <Input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" minLength={6} className="h-11 pr-11" required disabled={disabled} />
          <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar caracteres" : "Exibir caracteres"} aria-pressed={showPassword} className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      {state.error && <Alert className="border-red-200 bg-red-50 text-red-800">{state.error}</Alert>}
      <Button type="submit" size="lg" className="h-11" disabled={pending || disabled}>
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <LogIn className="size-4" />}
        {pending ? "Entrando..." : "Entrar no sistema"}
      </Button>
    </form>
  );
}
