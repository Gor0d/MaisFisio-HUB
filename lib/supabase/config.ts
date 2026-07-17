export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("seu-projeto"),
  );
}

export function getSupabaseConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "supabase-anon-key-not-configured",
  };
}
