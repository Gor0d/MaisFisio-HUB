// Só importar em rotas de API e server actions (nunca em componente "use client").
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

// Cliente service_role (ignora RLS). Só usar depois de validar a autoridade
// de quem pede; devolve null se a chave não estiver configurada no servidor.
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  const { url } = getSupabaseConfig();
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
