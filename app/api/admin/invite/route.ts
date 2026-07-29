import { createClient as createAdminClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  full_name: z.string().trim().min(2).max(120),
  role: z.enum(["admin", "coordenador", "colaborador"]),
  service_id: z.uuid(),
  unit_id: z.uuid("Selecione a unidade."),
});

const response = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

async function findUserByEmail(admin: SupabaseClient, email: string) {
  const perPage = 1000;

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user || data.users.length < perPage) return user ?? null;
  }

  return null;
}

function isRecoverableInvite(user: User) {
  return Boolean(user.invited_at)
    && !user.email_confirmed_at
    && !user.last_sign_in_at;
}

function provisioningMessage(code?: string) {
  if (code === "23505") {
    return "Já existe um profissional com esses dados. Revise a lista de usuários e tente novamente.";
  }
  if (code === "42501") {
    return "Você não tem permissão para concluir este convite na unidade selecionada.";
  }
  return "Não foi possível concluir o convite. Tente novamente; o sistema retomará o processo com segurança.";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return response("Confira os dados informados para o convite.", 400);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return response("Sua sessão expirou. Entre novamente para continuar.", 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,service_id")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role === "colaborador") {
    return response("Você não tem permissão para convidar usuários.", 403);
  }

  if (
    profile.role === "coordenador"
    && (
      parsed.data.role !== "colaborador"
      || parsed.data.service_id !== profile.service_id
    )
  ) {
    return response("Coordenadores só podem convidar colaboradores do próprio serviço.", 403);
  }

  if (profile.role !== "super_admin") {
    const { data: membership } = await supabase
      .from("profile_units")
      .select("unit_id")
      .eq("user_id", user.id)
      .eq("unit_id", parsed.data.unit_id)
      .maybeSingle();

    if (!membership) {
      return response("Você só pode convidar usuários para suas unidades.", 403);
    }
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return response("O serviço de convites está temporariamente indisponível.", 503);
  }

  const { url } = getSupabaseConfig();
  const admin = createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let authUser: User | null;
  try {
    authUser = await findUserByEmail(admin, parsed.data.email);
  } catch {
    return response("Não foi possível consultar os convites agora. Tente novamente em instantes.", 503);
  }

  let createdNow = false;
  if (authUser && !isRecoverableInvite(authUser)) {
    return response("Já existe um usuário com este e-mail. Use a opção “Gerenciar” para alterar o acesso.", 409);
  }

  if (!authUser) {
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin}/auth/callback?next=/definir-senha`;
    const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(
      parsed.data.email,
      {
        redirectTo,
        data: { full_name: parsed.data.full_name },
      },
    );

    if (error || !invited.user) {
      const status = error?.status === 429 ? 429 : 503;
      const message = status === 429
        ? "Muitos convites foram enviados em pouco tempo. Aguarde alguns minutos e tente novamente."
        : "Não foi possível enviar o convite por e-mail. Tente novamente em instantes.";
      return response(message, status);
    }

    authUser = invited.user;
    createdNow = true;
  }

  const { error: provisionError } = await admin.rpc("admin_provision_invited_user", {
    p_actor_id: user.id,
    p_target_user_id: authUser.id,
    p_full_name: parsed.data.full_name,
    p_role: parsed.data.role,
    p_service_id: parsed.data.service_id,
    p_unit_id: parsed.data.unit_id,
  });

  if (provisionError) {
    // Compensação do único recurso fora da transação. Se a remoção não puder
    // ocorrer, o convite pendente continua recuperável na próxima tentativa.
    if (createdNow) await admin.auth.admin.deleteUser(authUser.id);
    return response(provisioningMessage(provisionError.code), 500);
  }

  return NextResponse.json({
    ok: true,
    recovered: !createdNow,
    message: createdNow
      ? "Convite enviado e acesso configurado."
      : "Convite pendente recuperado e acesso configurado.",
  });
}
