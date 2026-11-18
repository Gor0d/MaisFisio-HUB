import { NextResponse } from "next/server";
import { authorizeTargetManagement } from "@/lib/admin-target";
import { generateProvisionalPassword, MUST_CHANGE_PASSWORD } from "@/lib/provisional-password";
import { createServiceClient } from "@/lib/supabase/admin";

// Substitui o "esqueci minha senha" por e-mail enquanto não há SMTP
// institucional: o gestor gera uma nova senha provisória, repassa à pessoa e
// ela é obrigada a trocá-la no próximo acesso. O Supabase encerra as sessões
// abertas da pessoa ao trocar a senha (confirmado no E2E), e a senha antiga
// deixa de funcionar na hora.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const auth = await authorizeTargetManagement(userId);
  if (!auth.ok) return auth.response;

  const admin = createServiceClient();
  if (!admin) {
    return NextResponse.json({ error: "Gestão administrativa temporariamente indisponível." }, { status: 503 });
  }

  const password = generateProvisionalPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
    app_metadata: { [MUST_CHANGE_PASSWORD]: true },
  });
  if (error) {
    console.error("Falha ao gerar senha provisória:", error.code);
    return NextResponse.json({ error: "Não foi possível gerar a senha provisória. Tente novamente." }, { status: 503 });
  }

  // Única vez em que a senha sai do servidor; não é registrada em log.
  return NextResponse.json({ ok: true, provisional_password: password });
}
