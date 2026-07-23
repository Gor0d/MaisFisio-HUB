import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  full_name: z.string().trim().min(2).max(120),
  role: z.enum(["admin", "coordenador", "colaborador"]),
  service_id: z.uuid(),
  active: z.boolean(),
  unit_ids: z.array(z.uuid()).min(1),
  collaborator_unit_ids: z.array(z.uuid()).min(1),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  if (!z.uuid().safeParse(userId).success) {
    return NextResponse.json({ error: "Usuário inválido." }, { status: 400 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Revise os dados e selecione as unidades." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }
  if (user.id === userId) {
    return NextResponse.json({ error: "Seu próprio acesso não pode ser alterado nesta tela." }, { status: 403 });
  }

  const [actorResult, targetResult, actorUnitsResult, targetUnitsResult] = await Promise.all([
    supabase.from("profiles").select("role,service_id,active").eq("user_id", user.id).single(),
    supabase.from("profiles").select("role,service_id").eq("user_id", userId).maybeSingle(),
    supabase.from("profile_units").select("unit_id").eq("user_id", user.id),
    supabase.from("profile_units").select("unit_id").eq("user_id", userId),
  ]);

  const actor = actorResult.data;
  const target = targetResult.data;
  if (!actor?.active || actor.role === "colaborador") {
    return NextResponse.json({ error: "Acesso administrativo negado." }, { status: 403 });
  }
  if (!target) {
    return NextResponse.json({ error: "Usuário não encontrado ou fora do seu escopo." }, { status: 404 });
  }
  if (target.role === "super_admin") {
    return NextResponse.json({ error: "Contas da matriz não são alteradas nesta tela." }, { status: 403 });
  }

  const actorUnits = new Set((actorUnitsResult.data ?? []).map((row) => row.unit_id));
  const targetUnits = new Set((targetUnitsResult.data ?? []).map((row) => row.unit_id));
  const requestedUnits = [...parsed.data.unit_ids, ...parsed.data.collaborator_unit_ids];

  if (actor.role !== "super_admin") {
    if (!requestedUnits.every((unitId) => actorUnits.has(unitId))) {
      return NextResponse.json({ error: "Você só pode vincular unidades às quais tem acesso." }, { status: 403 });
    }
    if (![...targetUnits].some((unitId) => actorUnits.has(unitId))) {
      return NextResponse.json({ error: "Usuário fora do seu escopo de unidades." }, { status: 403 });
    }
  }

  if (actor.role === "coordenador" && (
    target.role !== "colaborador"
    || parsed.data.role !== "colaborador"
    || target.service_id !== actor.service_id
    || parsed.data.service_id !== actor.service_id
  )) {
    return NextResponse.json({ error: "Coordenadores só gerenciam colaboradores do próprio serviço." }, { status: 403 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "Gestão administrativa temporariamente indisponível." }, { status: 503 });
  }

  const { url } = getSupabaseConfig();
  const admin = createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await admin.rpc("admin_update_user_access", {
    p_actor_id: user.id,
    p_target_user_id: userId,
    p_full_name: parsed.data.full_name,
    p_role: parsed.data.role,
    p_service_id: parsed.data.service_id,
    p_active: parsed.data.active,
    p_unit_ids: parsed.data.unit_ids,
    p_collaborator_unit_ids: parsed.data.collaborator_unit_ids,
  });

  if (error) {
    console.error("Falha ao atualizar acesso administrativo:", error.code);
    const message = error.code === "23505"
      ? "Já existe um colaborador com este nome no serviço selecionado."
      : "Não foi possível atualizar o acesso. Revise os vínculos e tente novamente.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
