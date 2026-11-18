import { describe, expect, it } from "vitest";
import { allowedDuringPasswordChange, generateProvisionalPassword, mustChangePassword } from "@/lib/provisional-password";

describe("senha provisória", () => {
  it("gera 3 blocos de 4 caracteres sem caracteres ambíguos", () => {
    for (let i = 0; i < 200; i += 1) {
      const password = generateProvisionalPassword();
      expect(password).toMatch(/^[A-HJ-NP-Za-hj-km-np-z2-9]{4}-[A-HJ-NP-Za-hj-km-np-z2-9]{4}-[A-HJ-NP-Za-hj-km-np-z2-9]{4}$/);
      expect(password).not.toMatch(/[0O1lI]/);
    }
  });

  it("não repete senhas", () => {
    const passwords = new Set(Array.from({ length: 1000 }, generateProvisionalPassword));
    expect(passwords.size).toBe(1000);
  });

  it("só exige troca quando a marca é exatamente true em app_metadata", () => {
    expect(mustChangePassword({ app_metadata: { must_change_password: true } })).toBe(true);
    expect(mustChangePassword({ app_metadata: { must_change_password: "true" } })).toBe(false);
    expect(mustChangePassword({ app_metadata: {} })).toBe(false);
    expect(mustChangePassword(null)).toBe(false);
  });

  it("bloqueia todas as telas e APIs, exceto troca de senha, callback e health", () => {
    for (const path of ["/definir-senha", "/auth/callback", "/api/health"]) {
      expect(allowedDuringPasswordChange(path)).toBe(true);
    }
    for (const path of ["/dashboard", "/lancamento", "/escalas/barthel", "/admin", "/api/admin/invite", "/api/admin/users/x/password", "/definir-senha-falsa", "/login"]) {
      expect(allowedDuringPasswordChange(path)).toBe(false);
    }
  });
});
