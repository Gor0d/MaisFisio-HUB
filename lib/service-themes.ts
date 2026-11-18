// Identidade visual e indicadores de destaque por especialidade, compartilhados
// pelo dashboard e pelo painel mensal de B.I.

// Paleta institucional (fisioterapia usa a família do azul-marinho da marca)
// validada em scripts/validate_palette.js — todos os checks CVD/contraste
// passam nesta ordem exata de exibição das abas (SERVICE_ORDER).
export const SERVICE_ORDER = ["fisioterapia", "terapia_ocupacional", "psicologia", "fonoaudiologia", "assistencia_social"];
export const THEMES: Record<string, { accent: string; soft: string }> = {
  fisioterapia: { accent: "#1d5ab0", soft: "#e7edf7" },
  terapia_ocupacional: { accent: "#d97706", soft: "#faf0e0" },
  psicologia: { accent: "#7c3aed", soft: "#f1ebfc" },
  fonoaudiologia: { accent: "#0891b2", soft: "#e3f2f6" },
  assistencia_social: { accent: "#db2777", soft: "#fbe9f1" },
};

// KPIs de destaque por especialidade (equivalentes aos cartões do B.I. antigo).
export const SERVICE_KPIS: Record<string, string[]> = {
  fisioterapia: ["fisio_pacientes_prescritos", "fisio_altas", "fisio_obitos", "fisio_taxa_captados"],
  terapia_ocupacional: ["to_geral_total", "to_enf_atendimentos", "to_enf_altas", "to_amb_individual"],
  psicologia: ["psi_atendimentos", "psi_admissoes", "psi_familiar", "psi_risco_suicidio"],
  fonoaudiologia: ["fono_atendimentos", "fono_altas", "fono_melhorias", "fono_broncoaspiracoes"],
  assistencia_social: ["social_atendimentos", "social_acolhimento", "social_alta", "social_evasoes"],
};
export const KPI_LABELS: Record<string, string> = {
  fisio_pacientes_prescritos: "Pacientes Prescritos", fisio_altas: "Altas", fisio_obitos: "Óbitos", fisio_taxa_captados: "Taxa de Captação",
  to_geral_total: "Atendimentos Gerais", to_enf_atendimentos: "Atendimentos na Enfermaria", to_enf_altas: "Altas da Enfermaria", to_amb_individual: "Atendimentos no Ambulatório",
  psi_atendimentos: "Atendimentos Realizados", psi_admissoes: "Admissões", psi_familiar: "Atendimento Familiar", psi_risco_suicidio: "Protocolo Risco de Suicídio",
  fono_atendimentos: "Atendimentos Realizados", fono_altas: "Altas da Fono", fono_melhorias: "Melhorias na Fonoterapia", fono_broncoaspiracoes: "Broncoaspirações",
  social_atendimentos: "Atendimentos Realizados", social_acolhimento: "Acolhimentos", social_alta: "Altas Hospitalares", social_evasoes: "Evasões",
};
