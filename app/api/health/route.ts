import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// Endpoint público de monitoramento (UptimeRobot etc.). Não expõe dados:
// apenas confirma que a aplicação responde e que a configuração existe.
export async function GET() {
  return NextResponse.json({ ok: true, configured: isSupabaseConfigured(), timestamp: new Date().toISOString() });
}
