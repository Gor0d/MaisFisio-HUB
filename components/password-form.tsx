"use client";

import { useActionState } from "react";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { setOwnPassword, type AuthState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthState = {};

export function PasswordForm() {
  const [state, action, pending] = useActionState(setOwnPassword, initialState);
  return <form action={action} className="grid gap-4"><div className="field"><Label htmlFor="new-password">Nova senha</Label><Input id="new-password" name="password" type="password" minLength={8} autoComplete="new-password" required /></div><div className="field"><Label htmlFor="confirmation">Confirmar nova senha</Label><Input id="confirmation" name="confirmation" type="password" minLength={8} autoComplete="new-password" required /></div>{state.error && <Alert className="border-red-200 bg-red-50 text-red-800">{state.error}</Alert>}<Button size="lg" disabled={pending}>{pending ? <LoaderCircle className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}{pending ? "Salvando..." : "Salvar senha e entrar"}</Button></form>;
}
