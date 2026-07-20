import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ptBRDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
export const ptBRNumber = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function friendlyError(error: unknown) {
  // Erros do Supabase (PostgrestError) são objetos simples, não instâncias de Error.
  const message = error instanceof Error ? error.message
    : typeof error === "object" && error !== null && "message" in error ? String((error as { message: unknown }).message)
    : String(error ?? "");
  if (message.includes("scale_assessments_unique_event_idx")) {
    return "Já existe uma avaliação desta escala para este paciente, momento e data. Confira no dashboard antes de salvar novamente.";
  }
  if (message.includes("duplicate key") || message.includes("production_records_service_id")) {
    return "Já existe um lançamento com estes dados.";
  }
  if (message.includes("Invalid login credentials")) return "E-mail ou senha inválidos.";
  if (message.includes("Email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  return message || "Não foi possível concluir a operação.";
}
