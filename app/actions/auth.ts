"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { MUST_CHANGE_PASSWORD, mustChangePassword } from "@/lib/provisional-password";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_UNIT_COOKIE } from "@/lib/units";
import { friendlyError } from "@/lib/utils";
import { loginSchema, recoverPasswordSchema } from "@/lib/validation";

export type AuthState = { error?: string; success?: string };

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: friendlyError(error) };
  if (mustChangePassword(data.user)) redirect("/definir-senha");

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

// Usada tanto na ativação/recuperação por e-mail quanto na troca da senha
// provisória. A senha é trocada com a sessão do próprio usuário; só depois
// disso a marca de "senha provisória" é removida (via service_role, pois o
// usuário não pode alterar app_metadata).
export async function setOwnPassword(_: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 8) return { error: "A senha deve ter ao menos 8 caracteres." };
  if (password !== confirmation) return { error: "A confirmação não corresponde à senha." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sua sessão expirou. Entre novamente para continuar." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "A nova senha deve ser diferente da senha provisória." };
    if (error.code === "weak_password") return { error: "Senha fraca. Use letras e números, com ao menos 8 caracteres." };
    return { error: "Não foi possível salvar a senha. Tente novamente." };
  }

  if (mustChangePassword(user)) {
    const admin = createServiceClient();
    const cleared = admin && await admin.auth.admin.updateUserById(user.id, { app_metadata: { [MUST_CHANGE_PASSWORD]: null } });
    if (!cleared || cleared.error) return { error: "Sua senha foi salva, mas o acesso não foi liberado. Peça ao gestor para gerar uma nova senha provisória." };
  }

  redirect("/dashboard");
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
