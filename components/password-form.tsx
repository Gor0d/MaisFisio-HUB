"use client";

import { LoaderCircle, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function PasswordForm() {
  const router = useRouter(); const [pending, setPending] = useState(false);
  async function submit(formData: FormData) {
    const password = String(formData.get("password")); const confirmation = String(formData.get("confirmation"));
    if (password.length < 8) { toast.error("A senha deve ter ao menos 8 caracteres."); return; }
    if (password !== confirmation) { toast.error("A confirmação não corresponde à senha."); return; }
    setPending(true); const { error } = await createClient().auth.updateUser({ password }); setPending(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Senha definida com sucesso."); router.replace("/dashboard"); router.refresh();
  }
  return <form action={submit} className="grid gap-4"><div className="field"><Label htmlFor="new-password">Senha</Label><Input id="new-password" name="password" type="password" minLength={8} autoComplete="new-password" required /></div><div className="field"><Label htmlFor="confirmation">Confirmar senha</Label><Input id="confirmation" name="confirmation" type="password" minLength={8} autoComplete="new-password" required /></div><Button size="lg" disabled={pending}>{pending ? <LoaderCircle className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}{pending ? "Salvando..." : "Ativar minha conta"}</Button></form>;
}
