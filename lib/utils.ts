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
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("duplicate key") || message.includes("production_records_service_id")) {
    return "Já existe um lançamento com estes dados.";
  }
  if (message.includes("Invalid login credentials")) return "E-mail ou senha inválidos.";
  if (message.includes("Email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  return message || "Não foi possível concluir a operação.";
}
