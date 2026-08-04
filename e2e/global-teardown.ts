import { existsSync, readFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { adminClient } from "./env";

export default async function globalTeardown() {
  const statePath = path.resolve(__dirname, ".state.json");
  if (!existsSync(statePath)) return;
  const state = JSON.parse(readFileSync(statePath, "utf8")) as { userId: string; unitId: string; collaboratorId: string; patientRecordNumber: string };
  const admin = adminClient();

  // Ordem importa: audit_logs bloqueia a exclusão do usuário (FK NO ACTION);
  // scale_assessments/production_records bloqueiam patients/o próprio usuário
  // enquanto existirem (created_by/patient_id também são NO ACTION).
  await admin.from("audit_logs").delete().eq("changed_by", state.userId);
  await admin.from("scale_assessments").delete().eq("created_by", state.userId);
  await admin.from("production_records").delete().eq("created_by", state.userId);
  // flow.spec.ts grava o paciente com um sufixo por projeto (.../e2e/flow.spec.ts,
  // recordNumber = `${patientRecordNumber}${isMobile ? "M" : "D"}`), então o
  // teardown precisa casar por prefixo, não igualdade exata.
  const { data: patients } = await admin.from("patients").select("id").eq("unit_id", state.unitId).like("record_number", `${state.patientRecordNumber}%`);
  if (patients?.length) await admin.from("patients").delete().in("id", patients.map((p) => p.id));
  await admin.from("collaborator_units").delete().eq("collaborator_id", state.collaboratorId);
  await admin.from("collaborators").delete().eq("id", state.collaboratorId);

  const { error } = await admin.auth.admin.deleteUser(state.userId);
  if (error) console.error(`Aviso: não foi possível remover o usuário de teste ${state.userId}: ${error.message}`);

  unlinkSync(statePath);
}
