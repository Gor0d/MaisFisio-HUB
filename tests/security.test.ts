import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = path.resolve("supabase/migrations");
const sql = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(path.join(migrationsDirectory, file), "utf8"))
  .join("\n");

describe("RLS", () => {
  it("habilita RLS nas tabelas clínicas", () => {
    for (const table of ["production_records", "production_values", "patients", "scale_assessments", "scale_scores", "profiles"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("não declara políticas para anon e restringe administração", () => {
    expect(sql).not.toMatch(/to\s+anon\b/i);
    expect(sql).toContain("public.is_super_admin()");
    expect(sql).toContain("public.current_app_role() = 'coordenador'");
  });

  it("escopa dados clínicos por unidade", () => {
    for (const table of ["units", "profile_units", "collaborator_units"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
    expect(sql).toContain("public.is_member_of(unit_id)");
    expect(sql).toContain("public.is_member_of(r.unit_id)");
    expect(sql).toContain("public.is_member_of(a.unit_id)");
    expect(sql).toContain('create policy "members read units"');
    expect(sql).toContain('create policy "unit and service members read collaborators"');
  });
});
