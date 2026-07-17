export type AppRole = "admin" | "coordenador" | "colaborador";
export type ScaleType = "barthel" | "mrc" | "melhoria_uti";
export type WorkShift = "MANHÃ" | "TARDE" | "NOITE";
export type SectorType = "Médica" | "Ortopédica" | "Cirúrgica";

export interface Profile {
  user_id: string;
  full_name: string;
  role: AppRole;
  service_id: string | null;
}

export interface Service {
  id: string;
  code: string;
  name: string;
}

export interface Sector {
  id: string;
  code: string;
  name: string;
  context: string;
}

export interface Collaborator {
  id: string;
  canonical_name: string;
  service_id: string;
}

export interface Indicator {
  id: string;
  service_id: string;
  code: string;
  name: string;
  context: "geral" | "uti" | "enfermaria" | "ambulatorio";
  kind: "contagem" | "taxa" | "texto";
  unit: string;
  display_order: number;
  derived: boolean;
}

export interface ScaleOption {
  id: string;
  item_id: string;
  label: string;
  points: number;
  display_order: number;
}

export interface ScaleItem {
  id: string;
  scale_type: ScaleType;
  code: string;
  name: string;
  display_order: number;
  max_points: number;
  scale_item_options: ScaleOption[];
}
