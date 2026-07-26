import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Libera estáticos de public/ (ícones, logo, manifest, service worker) sem
  // exigir sessão — antes só "icon.svg" (arquivo antigo) estava na lista, o
  // que redirecionava os novos ícones/logo para /login com anon key.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$|manifest\\.webmanifest|sw\\.js).*)"],
};
