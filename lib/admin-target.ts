import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Role = "super_admin" | "admin" | "coordenador" | "colaborador";
type Actor = { role: Role; service_id: string | null; active: boolean };
type Target = { role: Role; service_id: string | null };

export type TargetAuthorization =
  | { ok: true; actorId: string; actor: Actor; target: Target; actorUnits: Set<string> }
  | { ok: false; response: NextResponse };

const deny = (error: string, status: number): TargetAuthorization => ({
  ok: false,
  response: NextResponse.json({ error }, { status }),
});

// Regras comuns a toda ação de um gestor sobre a conta de outro usuário
// (alterar acesso, gerar senha provisória). Reforça no servidor o que a RLS
// já restringe, antes de qualquer chamada com service_role:
// - sessão ativa, nunca a própria conta, nunca conta da matriz;
// - colaborador não gerencia ninguém;
// - fora da matriz, o alvo precisa compartilhar ao menos uma unidade;
// - coordenador só atua sobre colaboradores do próprio serviço.
export async function authorizeTargetManagement(userId: string): Promise<TargetAuthorization> {
  if (!z.uuid().safeParse(userId).success) return deny("Usuário inválido.", 400);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return deny("Sessão expirada.", 401);
  if (user.id === userId) return deny("Seu próprio acesso não pode ser alterado nesta tela.", 403);

  const [actorResult, targetResult, actorUnitsResult, targetUnitsResult] = await Promise.all([
    supabase.from("profiles").select("role,service_id,active").eq("user_id", user.id).single(),
    supabase.from("profiles").select("role,service_id").eq("user_id", userId).maybeSingle(),
    supabase.from("profile_units").select("unit_id").eq("user_id", user.id),
    supabase.from("profile_units").select("unit_id").eq("user_id", userId),
  ]);

  const actor = actorResult.data as Actor | null;
  const target = targetResult.data as Target | null;
  if (!actor?.active || actor.role === "colaborador") return deny("Acesso administrativo negado.", 403);
  if (!target) return deny("Usuário não encontrado ou fora do seu escopo.", 404);
  if (target.role === "super_admin") return deny("Contas da matriz não são alteradas nesta tela.", 403);

  const actorUnits = new Set((actorUnitsResult.data ?? []).map((row) => row.unit_id as string));
  const targetUnits = (targetUnitsResult.data ?? []).map((row) => row.unit_id as string);
  if (actor.role !== "super_admin" && !targetUnits.some((unitId) => actorUnits.has(unitId))) {
    return deny("Usuário fora do seu escopo de unidades.", 403);
  }

  if (actor.role === "coordenador" && (target.role !== "colaborador" || target.service_id !== actor.service_id)) {
    return deny("Coordenadores só gerenciam colaboradores do próprio serviço.", 403);
  }

  return { ok: true, actorId: user.id, actor, target, actorUnits };
}
