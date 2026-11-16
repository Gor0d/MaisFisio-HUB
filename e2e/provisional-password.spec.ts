import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { adminClient } from "./env";

type State = { runId: string; email: string; password: string };

function loadState(): State {
  return JSON.parse(readFileSync(path.resolve(__dirname, ".state.json"), "utf8"));
}

function field(page: Page, label: string): Locator {
  return page.locator(".field").filter({ has: page.getByText(label, { exact: true }) });
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
}

// O coordenador descartável do global-setup cria um colaborador com senha
// provisória pela tela de administração. O novo usuário é removido no
// global-teardown (e-mail com prefixo `e2e.<runId>.novo`).
test.describe("Acesso por senha provisória (sem e-mail)", () => {
  test("cria acesso, obriga a troca no 1º login e permite gerar nova senha", async ({ page, browser }, testInfo) => {
    const state = loadState();
    const suffix = testInfo.project.name.includes("Mobile") ? "m" : "d";
    const newEmail = `e2e.${state.runId}.novo${suffix}@maisfisio.invalid`;
    const newName = `E2E Novo ${state.runId}${suffix}`;
    const finalPassword = `Pessoal!${state.runId}`;

    let provisional = "";
    await test.step("coordenador cria o acesso com senha provisória", async () => {
      await login(page, state.email, state.password);
      await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
      await page.goto("/admin");
      await field(page, "Nome completo do profissional").locator("input").fill(newName);
      await field(page, "E-mail").locator("input").fill(newEmail);
      await expect(field(page, "Forma de acesso").locator("select")).toHaveValue("password");
      await page.getByRole("button", { name: "Criar acesso" }).click();
      await expect(page.getByText(`Senha provisória de ${newName}`)).toBeVisible({ timeout: 20_000 });
      provisional = (await page.locator("p.font-mono").innerText()).trim();
      expect(provisional).toMatch(/^\w{4}-\w{4}-\w{4}$/);
    });

    const newUser = await browser.newContext();
    const newPage = await newUser.newPage();

    await test.step("1º login leva à troca obrigatória e bloqueia o resto", async () => {
      await login(newPage, newEmail, provisional);
      await newPage.waitForURL(/\/definir-senha/, { timeout: 30_000 });
      await expect(newPage.getByRole("heading", { name: "Crie sua senha pessoal" })).toBeVisible();
      for (const blocked of ["/dashboard", "/lancamento", "/admin"]) {
        await newPage.goto(blocked);
        await expect(newPage).toHaveURL(/\/definir-senha$/);
      }
      const api = await newPage.request.post("/api/admin/invite", { data: {}, maxRedirects: 0 });
      expect(api.status()).toBe(307);
    });

    await test.step("não aceita repetir a senha provisória", async () => {
      await newPage.getByLabel("Nova senha", { exact: true }).fill(provisional);
      await newPage.getByLabel("Confirmar nova senha").fill(provisional);
      await newPage.getByRole("button", { name: "Salvar senha e entrar" }).click();
      await expect(newPage.getByText("A nova senha deve ser diferente da senha provisória.")).toBeVisible({ timeout: 20_000 });
    });

    await test.step("troca a senha e entra no sistema", async () => {
      await newPage.getByLabel("Nova senha", { exact: true }).fill(finalPassword);
      await newPage.getByLabel("Confirmar nova senha").fill(finalPassword);
      await newPage.getByRole("button", { name: "Salvar senha e entrar" }).click();
      await newPage.waitForURL(/\/dashboard/, { timeout: 30_000 });
      await newPage.goto("/lancamento");
      await expect(newPage).toHaveURL(/\/lancamento$/);

      const { data } = await adminClient().auth.admin.listUsers({ perPage: 1000 });
      const created = data.users.find((user) => user.email === newEmail);
      expect(created?.app_metadata?.must_change_password).toBeUndefined();
    });

    await test.step("gestor gera nova senha provisória: sessões abertas caem e o novo login exige troca", async () => {
      await page.goto("/admin");
      const row = page.locator("div.flex.items-center").filter({ hasText: newName });
      await row.getByRole("button", { name: "Gerenciar" }).click();
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Gerar nova senha provisória" }).click();
      await expect(page.getByText(`Senha provisória de ${newName}`)).toBeVisible({ timeout: 20_000 });
      const second = (await page.locator("p.font-mono").innerText()).trim();
      expect(second).not.toBe(provisional);

      // O Supabase revoga as sessões ao trocar a senha pelo admin.
      await newPage.goto("/dashboard");
      await expect(newPage).toHaveURL(/\/login/);
      await expect(login(newPage, newEmail, finalPassword).then(() => newPage.getByText("E-mail ou senha inválidos.").waitFor())).resolves.toBeUndefined();
      await login(newPage, newEmail, second);
      await newPage.waitForURL(/\/definir-senha/, { timeout: 30_000 });
    });

    await newUser.close();
  });
});
