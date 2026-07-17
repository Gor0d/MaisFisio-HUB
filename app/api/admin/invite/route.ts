import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.email(), full_name: z.string().trim().min(2).max(120),
  role: z.enum(["admin", "coordenador", "colaborador"]), service_id: z.uuid(),
  unit_id: z.uuid("Selecione a unidade."),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Dados do convite inválidos." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role,service_id").eq("user_id", user.id).single();
  if (!profile || profile.role === "colaborador") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  if (profile.role === "coordenador" && (parsed.data.role !== "colaborador" || parsed.data.service_id !== profile.service_id)) return NextResponse.json({ error: "Coordenadores só podem convidar colaboradores do próprio serviço." }, { status: 403 });
  if (profile.role !== "super_admin") {
    const { data: membership } = await supabase.from("profile_units").select("unit_id").eq("user_id", user.id).eq("unit_id", parsed.data.unit_id).maybeSingle();
    if (!membership) return NextResponse.json({ error: "Você só pode convidar para unidades às quais tem acesso." }, { status: 403 });
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor." }, { status: 503 });
  const { url } = getSupabaseConfig();
  const admin = createAdminClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin}/auth/callback?next=/definir-senha`;
  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, { redirectTo, data: { full_name: parsed.data.full_name } });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { error: profileError } = await admin.from("profiles").update({ role: parsed.data.role, service_id: parsed.data.service_id, full_name: parsed.data.full_name }).eq("user_id", invited.user.id);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  const { error: unitError } = await admin.from("profile_units").upsert({ user_id: invited.user.id, unit_id: parsed.data.unit_id });
  if (unitError) return NextResponse.json({ error: unitError.message }, { status: 500 });
  const { data: collaborator, error: collaboratorError } = await admin.from("collaborators").upsert({ canonical_name: parsed.data.full_name, service_id: parsed.data.service_id, user_id: invited.user.id }, { onConflict: "service_id,normalized_name" }).select("id").single();
  if (collaboratorError) return NextResponse.json({ error: collaboratorError.message }, { status: 500 });
  const { error: collaboratorUnitError } = await admin.from("collaborator_units").upsert({ collaborator_id: collaborator.id, unit_id: parsed.data.unit_id });
  if (collaboratorUnitError) return NextResponse.json({ error: collaboratorUnitError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
