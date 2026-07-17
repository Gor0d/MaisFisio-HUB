import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(path.resolve("supabase/migrations/202607160002_security_views.sql"), "utf8");

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
  });
});
