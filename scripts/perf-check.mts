// Medição de desempenho contra a produção, como um usuário real (com RLS).
// Cria um admin descartável da unidade Galileu, mede consultas do dashboard
// e o carregamento das telas no site publicado, e remove o usuário no fim.
//   npx tsx scripts/perf-check.mts [rótulo]
// Exige .env.local com NEXT_PUBLIC_SUPABASE_URL, ANON e SERVICE_ROLE.
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).trim()]; }));
const SITE = process.env.PERF_SITE ?? "https://mais-fisio-hub.vercel.app";
const label = process.argv[2] ?? "medição";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const runId = Date.now().toString(36);
const email = `perf.${runId}@maisfisio.invalid`;
const password = `Perf!${runId}x9`;
const { data: unit } = await admin.from("units").select("id").eq("code", "galileu").single();
const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (error || !created.user || !unit) throw new Error(`setup: ${error?.message}`);
const userId = created.user.id;

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
async function timed<T>(fn: () => PromiseLike<T>, runs = 5) {
  const times: number[] = []; let last: T | undefined;
  for (let i = 0; i < runs; i += 1) { const t = performance.now(); last = await fn(); times.push(performance.now() - t); }
  return { ms: Math.round(median(times)), last: last as T };
}

try {
  await admin.from("profiles").update({ role: "admin", active: true, full_name: "Perf Teste" }).eq("user_id", userId);
  await admin.from("profile_units").insert({ user_id: userId, unit_id: unit.id });

  const user = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await user.auth.signInWithPassword({ email, password });

  const today = new Date().toISOString().slice(0, 10);

  // Mês com dados históricos densos (a planilha vai até meados de 2026).
  const { data: lastRec } = await admin.from("production_records").select("record_date").order("record_date", { ascending: false }).limit(1).single();
  const end = lastRec?.record_date ?? today;
  const start30 = new Date(new Date(end).getTime() - 30 * 864e5).toISOString().slice(0, 10);
  const start365 = new Date(new Date(end).getTime() - 365 * 864e5).toISOString().slice(0, 10);

  const totals = (s: string) => user.rpc("production_metrics_totals", { p_start: s, p_end: end, p_unit: unit.id, p_service: null, p_sector: null, p_shift: null, p_collaborator: null });
  const rows30 = async () => {
    let total = 0;
    for (let from = 0; ; from += 1000) {
      const { data, error: e } = await user.from("production_metrics").select("record_date,indicator_code,value,collaborator_id").eq("unit_id", unit.id).gte("record_date", start30).lte("record_date", end).order("record_date").range(from, from + 999);
      if (e) throw e; total += data.length; if (data.length < 1000) break;
    }
    return total;
  };

  const results: Record<string, string> = {};
  results["totais (30 dias)"] = `${(await timed(() => totals(start30))).ms} ms`;
  results["totais (12 meses)"] = `${(await timed(() => totals(start365))).ms} ms`;
  const r = await timed(rows30, 3);
  results["linhas do dashboard (30 dias)"] = `${r.ms} ms · ${r.last} linhas`;
  const r365 = async () => { let total = 0; for (let from = 0; ; from += 1000) { const { data, error: e } = await user.from("production_metrics").select("record_date,indicator_code,value,collaborator_id").eq("unit_id", unit.id).gte("record_date", start365).lte("record_date", end).order("record_date").range(from, from + 999); if (e) throw e; total += data.length; if (data.length < 1000) break; } return total; };
  const y = await timed(r365, 1);
  results["linhas do dashboard (12 meses)"] = `${y.ms} ms · ${y.last} linhas`;
  console.log(results);
  results["lista de colaboradores"] = `${(await timed(() => user.from("collaborators").select("id,canonical_name,service_id").eq("active", true))).ms} ms`;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${SITE}/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  let t = performance.now();
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  results["login → dashboard pronto"] = `${Math.round(performance.now() - t)} ms`;
  for (const path of ["/dashboard", `/dashboard?de=${start365}&ate=${end}`, "/lancamento", "/escalas/barthel", "/relatorios"]) {
    const times: number[] = [];
    const heavy = path.includes("?");
    for (let i = 0; i < (heavy ? 1 : 3); i += 1) { t = performance.now(); await page.goto(`${SITE}${path}`, { waitUntil: "networkidle", timeout: 180_000 }); times.push(performance.now() - t); }
    const key = `tela ${path.replace(/\?.*/, "")}${heavy ? " (12 meses)" : ""}`;
    results[key] = `${Math.round(median(times))} ms`;
    console.log(key, results[key]);
  }
  await browser.close();

  console.log(`\n== ${label} (${new Date().toISOString()}) — mediana; base de dados: até ${end}`);
  for (const [k, v] of Object.entries(results)) console.log(`${k.padEnd(34)} ${v}`);
} finally {
  await admin.from("audit_logs").delete().eq("changed_by", userId);
  await admin.from("profile_units").delete().eq("user_id", userId);
  const { error: delError } = await admin.auth.admin.deleteUser(userId);
  console.log(delError ? `AVISO: usuário ${email} não removido: ${delError.message}` : "usuário descartável removido");
}
