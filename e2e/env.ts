import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function readEnvLocal() {
  const file = readFileSync(path.resolve(__dirname, "../.env.local"), "utf8");
  const values: Record<string, string> = {};
  for (const line of file.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) values[match[1]] = match[2].trim();
  }
  return values;
}

export function adminClient() {
  const env = readEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes em .env.local");
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
