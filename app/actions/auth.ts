"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_UNIT_COOKIE } from "@/lib/units";
import { friendlyError } from "@/lib/utils";
import { loginSchema, recoverPasswordSchema } from "@/lib/validation";

export type AuthState = { error?: string; success?: string };

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: friendlyError(error) };

  const target = String(formData.get("redirect") ?? "/dashboard");
  redirect(target.startsWith("/") && !target.startsWith("//") ? target : "/dashboard");
}

async function appOrigin() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const list = await headers();
  return `${list.get("x-forwarded-proto") ?? "http"}://${list.get("host")}`;
}

// Mensagem de sucesso é sempre a mesma, exista ou não o e-mail na base — o
// próprio Supabase já não erra nesse caso, mas mantemos explícito aqui para
// não abrir brecha de enumeração de usuários se isso mudar no futuro.
export async function requestPasswordReset(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = recoverPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const redirectTo = `${await appOrigin()}/auth/callback?next=/definir-senha`;
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });
  if (error?.status === 429) return { error: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente." };

  return { success: "Se este e-mail estiver cadastrado, enviamos um link para redefinir a senha. Confira também a caixa de spam." };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function setActiveUnit(formData: FormData) {
  const unitId = String(formData.get("unit_id") ?? "");
  if (!/^([0-9a-f-]{36}|all)$/.test(unitId)) return;
  (await cookies()).set(ACTIVE_UNIT_COOKIE, unitId, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
