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

// Aceita grupos de 1-2 letras separados por ponto/espaço ("J.R.S", "M. A. S.")
// ou um bloco compacto de 2-4 letras sem separador ("MAS", "EGG"). Rejeita de
// forma confiável qualquer nome com uma palavra de 3+ letras — espelhado na
// função SQL save_scale_assessment (supabase/migrations/202607210009).
const INITIALS_PATTERN = /^(([A-ZÀ-Ÿ]{1,2}[.\s]+){1,7}[A-ZÀ-Ÿ]{1,2}\.?|[A-ZÀ-Ÿ]{2,4})$/i;

export const scaleAssessmentSchema = z.object({
  unit_id: z.uuid("Selecione a unidade."),
  scale_type: z.enum(["barthel", "mrc", "melhoria_uti"]),
  initials: z.string().trim().min(1).max(30).regex(INITIALS_PATTERN, "Use somente iniciais (ex.: M.A.S. ou MAS); não informe o nome completo."),
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
}).superRefine((data, ctx) => {
  // A escala MRC tem colaborador e número de atendimento na planilha de
  // origem; Barthel e Melhoria UTI não têm esse campo, então ficam opcionais.
  if (data.scale_type === "mrc") {
    if (!data.collaborator_id) ctx.addIssue({ code: "custom", path: ["collaborator_id"], message: "A escala MRC exige o colaborador responsável." });
    if (!data.attendance_number?.trim()) ctx.addIssue({ code: "custom", path: ["attendance_number"], message: "A escala MRC exige o número do atendimento." });
  }
});
