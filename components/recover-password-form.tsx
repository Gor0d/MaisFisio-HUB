"use client";

import { useActionState } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { requestPasswordReset, type AuthState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthState = {};

export function RecoverPasswordForm({ disabled }: { disabled?: boolean }) {
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);
  return (
    <form action={action} className="grid gap-5">
      <div className="field">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="voce@maisfisio.com.br" required disabled={disabled || Boolean(state.success)} />
      </div>
      {state.error && <Alert className="border-red-200 bg-red-50 text-red-800">{state.error}</Alert>}
      {state.success && <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">{state.success}</Alert>}
      {!state.success && (
        <Button type="submit" size="lg" disabled={pending || disabled}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
          {pending ? "Enviando..." : "Enviar link de redefinição"}
        </Button>
      )}
    </form>
  );
}
