"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/utils";
import { loginSchema } from "@/lib/validation";

export type AuthState = { error?: string };

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: friendlyError(error) };

  const target = String(formData.get("redirect") ?? "/dashboard");
  redirect(target.startsWith("/") && !target.startsWith("//") ? target : "/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
