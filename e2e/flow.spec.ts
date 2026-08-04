import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { adminClient } from "./env";

type State = {
  runId: string;
  userId: string;
  email: string;
  password: string;
  unitId: string;
  unitName: string;
  sectorId: string;
  sectorName: string;
  indicatorId: string;
  indicatorName: string;
  collaboratorId: string;
  collaboratorName: string;
  patientRecordNumber: string;
  patientInitials: string;
};

function loadState(): State {
  return JSON.parse(readFileSync(path.resolve(__dirname, ".state.json"), "utf8"));
}

// Os formulários usam <Label> como texto solto ao lado do campo, sem
// htmlFor/id (ver components/production-form.tsx e scale-form.tsx) — então
// getByLabel não funciona. Isolamos pelo container .field mais próximo cujo
// texto exato bate com o rótulo (exact evita "Setor" casar com "Tipo de setor").
function field(page: Page, label: string): Locator {
  return page.locator(".field").filter({ has: page.getByText(label, { exact: true }) });
}

test.describe("Fluxo principal: login → lançamento → Barthel entrada/saída → dashboard", () => {
  test("registra produção e uma avaliação Barthel completa, com melhora refletida", async ({ page }, testInfo) => {
    const state = loadState();
    const isMobile = testInfo.project.name.includes("Mobile");
    // Projetos rodam em série contra o mesmo usuário/coletor descartável
    // (global-setup único) — sufixo evita colidir com as constraints únicas
    // de production_records e scale_assessments entre Desktop e Mobile.
    const recordNumber = `${state.patientRecordNumber}${isMobile ? "M" : "D"}`;
    const shift = isMobile ? "TARDE" : "MANHÃ";

    await test.step("login", async () => {
      await page.goto("/login");
      await page.getByLabel("E-mail").fill(state.email);
      await page.getByLabel("Senha").fill(state.password);
      await page.getByRole("button", { name: "Entrar no sistema" }).click();
      // Primeira requisição contra o dev server ainda pode estar compilando a
      // server action sob demanda (Next dev), então dá mais tempo só aqui.
      await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    });

    await test.step("lançamento de produção (Fisioterapia)", async () => {
      await page.goto("/lancamento");
      await field(page, "Colaborador(a)").locator("select").selectOption({ label: state.collaboratorName });
      await field(page, "Turno").locator("select").selectOption(shift);
      await field(page, "Setor").locator("select").selectOption({ label: state.sectorName });
      await page.getByLabel(state.indicatorName).fill("3");
      await page.getByRole("button", { name: "Salvar produção" }).click();
      await expect(page.getByText("Produção registrada com sucesso.")).toBeVisible();
    });

    async function fillBarthelStep1(moment: "entrada" | "saida") {
      await page.goto("/escalas/barthel");
      await field(page, "Iniciais do paciente").locator("input").fill(state.patientInitials);
      await field(page, "Nº de registro/prontuário").locator("input").fill(recordNumber);
      await field(page, "Momento").locator("select").selectOption(moment);
      await field(page, "Setor").locator("select").selectOption({ label: state.sectorName });
    }

    async function answerAllItems(pick: "first" | "last") {
      const itemCards = page.locator(".rounded-2xl").filter({ has: page.locator('input[type="radio"]') });
      const count = await itemCards.count();
      expect(count).toBe(10); // Barthel tem 10 itens
      for (let i = 0; i < count; i += 1) {
        const radios = itemCards.nth(i).locator('input[type="radio"]');
        await (pick === "first" ? radios.first() : radios.last()).check();
      }
    }

    await test.step("Barthel — entrada (pontuação mínima)", async () => {
      await fillBarthelStep1("entrada");
      await page.getByRole("button", { name: "Continuar" }).click();
      await answerAllItems("first"); // opção de menor pontuação em cada item
      await expect(page.getByText("10 de 10 itens")).toBeVisible();
      await page.getByRole("button", { name: "Salvar avaliação" }).click();
      await expect(page.getByText("Avaliação salva.", { exact: false })).toBeVisible();
    });

    await test.step("Barthel — saída (pontuação máxima, melhora esperada)", async () => {
      await fillBarthelStep1("saida");
      // Paciente já tem entrada avaliada hoje: o formulário busca e mostra o
      // total da entrada antes mesmo de responder os itens da saída.
      await expect(page.getByText("Paciente localizado", { exact: false })).toBeVisible();
      await page.getByRole("button", { name: "Continuar" }).click();
      await answerAllItems("last"); // opção de maior pontuação em cada item
      await expect(page.getByText("melhora", { exact: false })).toBeVisible();
      await page.getByRole("button", { name: "Salvar avaliação" }).click();
      await expect(page.getByText("Avaliação salva.", { exact: false })).toBeVisible();
    });

    await test.step("dashboard carrega sem erro após os lançamentos", async () => {
      await page.goto("/dashboard");
      await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
    });

    await test.step("conferência direta no banco: total e flag de melhora", async () => {
      const admin = adminClient();
      const { data: record } = await admin
        .from("production_records")
        .select("id")
        .eq("created_by", state.userId)
        .eq("collaborator_id", state.collaboratorId)
        .eq("shift", shift)
        .single();
      const { data: value } = await admin
        .from("production_values")
        .select("numeric_value")
        .eq("record_id", record!.id)
        .eq("indicator_id", state.indicatorId)
        .single();
      expect(Number(value?.numeric_value)).toBe(3);

      // scale_assessment_results filtra por is_member_of(unit_id), que lê
      // auth.uid() — vazio para o client de service_role, então a view não
      // devolve nada aqui. Lendo a tabela base diretamente (bypassrls) e
      // recalculando "melhora" com a mesma regra da view (saída > entrada).
      const { data: patient } = await admin.from("patients").select("id").eq("unit_id", state.unitId).eq("record_number", recordNumber).single();
      const { data: assessments } = await admin
        .from("scale_assessments")
        .select("moment, total, complete")
        .eq("patient_id", patient!.id)
        .eq("scale_type", "barthel")
        .order("moment", { ascending: true });
      const entrada = assessments?.find((r) => r.moment === "entrada");
      const saida = assessments?.find((r) => r.moment === "saida");
      expect(entrada?.total).toBe(0);
      expect(entrada?.complete).toBe(true);
      expect(saida?.total).toBe(100);
      expect(saida?.complete).toBe(true);
      expect(saida!.total > entrada!.total).toBe(true);
    });
  });
});
