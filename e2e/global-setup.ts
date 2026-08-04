import { writeFileSync } from "node:fs";
import path from "node:path";
import { adminClient } from "./env";

// Cria um usuário, colaborador e vínculos descartáveis em produção — mesmo
// padrão já usado manualmente neste projeto (ver docs/handoff-agentes.md):
// dados reais, mas isolados por um sufixo único e sempre removidos no
// global-teardown, inclusive as linhas de audit_logs que bloqueiam a exclusão
// do usuário (FK audit_logs_changed_by_fkey é NO ACTION, não CASCADE).
export default async function globalSetup() {
  const admin = adminClient();
  const runId = Date.now().toString(36);

  const { data: service } = await admin.from("services").select("id,name").eq("code", "fisioterapia").single();
  const { data: unit } = await admin.from("units").select("id,name").eq("code", "galileu").single();
  const { data: sector } = await admin.from("sectors").select("id,name").eq("unit_id", unit!.id).eq("code", "uti").single();
  const { data: indicator } = await admin.from("indicators").select("id,name").eq("service_id", service!.id).eq("code", "fisio_pacientes_prescritos").single();
  if (!service || !unit || !sector || !indicator) throw new Error("Referências de catálogo não encontradas — confira services/units/sectors/indicators em produção.");

  const email = `e2e.${runId}@maisfisio.invalid`;
  const password = `E2eTeste!${runId}`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError || !created.user) throw new Error(`Falha ao criar usuário de teste: ${createError?.message}`);
  const userId = created.user.id;

  const { error: profileError } = await admin.from("profiles").update({ role: "coordenador", service_id: service.id, active: true }).eq("user_id", userId);
  if (profileError) throw new Error(`Falha ao configurar perfil de teste: ${profileError.message}`);

  const { error: profileUnitError } = await admin.from("profile_units").insert({ user_id: userId, unit_id: unit.id });
  if (profileUnitError) throw new Error(`Falha ao vincular unidade ao perfil de teste: ${profileUnitError.message}`);

  const { data: collaborator, error: collaboratorError } = await admin
    .from("collaborators")
    .insert({ canonical_name: `E2E Teste ${runId}`, service_id: service.id, active: true })
    .select("id,canonical_name")
    .single();
  if (collaboratorError || !collaborator) throw new Error(`Falha ao criar colaborador de teste: ${collaboratorError?.message}`);

  const { error: collaboratorUnitError } = await admin.from("collaborator_units").insert({ collaborator_id: collaborator.id, unit_id: unit.id });
  if (collaboratorUnitError) throw new Error(`Falha ao vincular unidade ao colaborador de teste: ${collaboratorUnitError.message}`);

  const state = {
    runId,
    userId,
    email,
    password,
    unitId: unit.id,
    unitName: unit.name,
    serviceId: service.id,
    sectorId: sector.id,
    sectorName: sector.name,
    indicatorId: indicator.id,
    indicatorName: indicator.name,
    collaboratorId: collaborator.id,
    collaboratorName: collaborator.canonical_name,
    patientRecordNumber: `E2E-${runId}`,
    patientInitials: "ZZ",
  };
  writeFileSync(path.resolve(__dirname, ".state.json"), JSON.stringify(state, null, 2));
}
