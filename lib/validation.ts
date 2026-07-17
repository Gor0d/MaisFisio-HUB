import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres."),
});

export const productionSchema = z.object({
  unit_id: z.uuid("Selecione a unidade."),
  service_id: z.uuid(),
  record_date: z.iso.date(),
  shift: z.enum(["MANHÃ", "TARDE", "NOITE"]),
  sector_id: z.uuid("Selecione o setor."),
  sector_type: z.enum(["Médica", "Ortopédica", "Cirúrgica"]).optional(),
  collaborator_id: z.uuid("Selecione o colaborador."),
  context: z.enum(["geral", "uti", "enfermaria", "ambulatorio"]),
  notes: z.string().max(2000).optional(),
  values: z.array(z.object({ indicator_id: z.uuid(), value: z.string() })),
});

export const scaleAssessmentSchema = z.object({
  unit_id: z.uuid("Selecione a unidade."),
  scale_type: z.enum(["barthel", "mrc", "melhoria_uti"]),
  initials: z.string().trim().min(1).max(30).regex(/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ. -]*$/, "Use somente iniciais; não informe o nome completo."),
  record_number: z.string().trim().min(1, "Informe o registro/prontuário.").max(50),
  age: z.coerce.number().int().min(0).max(130).optional(),
  collaborator_id: z.uuid().optional(),
  assessment_date: z.iso.date(),
  moment: z.enum(["entrada", "saida"]),
  sector_id: z.uuid(),
  sector_type: z.enum(["Médica", "Ortopédica", "Cirúrgica"]).optional(),
  attendance_number: z.string().max(50).optional(),
  cid: z.string().max(120).optional(),
  event_date: z.iso.date().optional(),
  notes: z.string().max(2000).optional(),
  answers: z.array(z.object({ item_id: z.uuid(), option_id: z.uuid() })).min(1),
});
