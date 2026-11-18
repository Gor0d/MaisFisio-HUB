import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeTargetManagement } from "@/lib/admin-target";
import { createServiceClient } from "@/lib/supabase/admin";

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

  const auth = await authorizeTargetManagement(userId);
  if (!auth.ok) return auth.response;
  const { actor, actorId, actorUnits } = auth;

  const requestedUnits = [...parsed.data.unit_ids, ...parsed.data.collaborator_unit_ids];
  if (actor.role !== "super_admin" && !requestedUnits.every((unitId) => actorUnits.has(unitId))) {
    return NextResponse.json({ error: "Você só pode vincular unidades às quais tem acesso." }, { status: 403 });
  }

  if (actor.role === "coordenador" && (
    parsed.data.role !== "colaborador"
    || parsed.data.service_id !== actor.service_id
  )) {
    return NextResponse.json({ error: "Coordenadores só gerenciam colaboradores do próprio serviço." }, { status: 403 });
  }

  const admin = createServiceClient();
  if (!admin) {
    return NextResponse.json({ error: "Gestão administrativa temporariamente indisponível." }, { status: 503 });
  }

  const { error } = await admin.rpc("admin_update_user_access", {
    p_actor_id: actorId,
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
