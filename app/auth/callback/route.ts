import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) await (await createClient()).auth.exchangeCodeForSession(code);
  const requested = searchParams.get("next") ?? "/dashboard";
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard";
  return NextResponse.redirect(`${origin}${next}`);
}
