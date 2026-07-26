// Backup lógico de segurança: exporta todas as tabelas do schema public para
// JSON, em uma pasta com timestamp. É uma camada ADICIONAL de redundância —
// não substitui os backups gerenciados do Supabase (diários + PITR no plano
// Pro), que continuam sendo a proteção principal contra perda de dados.
//
// Uso: DB_URL="postgresql://..." node scripts/backup-database.mjs
import pg from "pg";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DB_URL = process.env.DB_URL;
if (!DB_URL) throw new Error("Defina DB_URL com a connection string do Postgres.");

const TABLES = [
  "units", "services", "sectors", "service_sectors", "indicators",
  "scale_items", "scale_item_options",
  "profiles", "profile_units", "collaborators", "collaborator_units", "collaborator_aliases",
  "patients", "production_records", "production_values",
  "scale_assessments", "scale_scores", "indicator_targets", "audit_logs",
];

async function main() {
  const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.resolve("backups", stamp);
  await mkdir(dir, { recursive: true });

  const summary = {};
  for (const table of TABLES) {
    const { rows } = await client.query(`select * from public.${table}`);
    await writeFile(path.join(dir, `${table}.json`), JSON.stringify(rows, null, 0), "utf8");
    summary[table] = rows.length;
    console.log(`  ${table}: ${rows.length} linhas`);
  }

  await writeFile(path.join(dir, "_resumo.json"), JSON.stringify({ geradoEm: new Date().toISOString(), linhas: summary }, null, 2), "utf8");
  await client.end();
  console.log(`\nBackup salvo em: ${dir}`);
}

main().catch((error) => { console.error("ERRO no backup:", error.message); process.exitCode = 1; });
