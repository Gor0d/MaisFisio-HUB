import type { Metadata } from "next";
import Image from "next/image";
import { Activity, BarChart3, Building2, ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { SetupRequired } from "@/components/setup-required";
import { Alert } from "@/components/ui/alert";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Entrar" };

const ERROR_MESSAGES: Record<string, string> = {
  inativo: "Sua conta está inativa. Procure o administrador da sua unidade para reativar o acesso.",
};

const FEATURES = [
  { icon: Activity, title: "Escalas calculadas", text: "Barthel, MRC e Melhoria UTI sem conta manual" },
  { icon: BarChart3, title: "Indicadores em tempo real", text: "Produção e evolução clínica por serviço" },
  { icon: Building2, title: "Várias unidades", text: "Cada hospital com seus dados, separados" },
  { icon: ShieldCheck, title: "Dados protegidos", text: "Acesso por perfil e paciente sem nome" },
];

// Tela neutra (sem nome de hospital): o sistema atende várias unidades. A
// unidade só aparece depois da autenticação (/selecionar-unidade) — mostrar
// antes da senha revelaria a quem pertence um e-mail.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ redirect?: string; erro?: string }> }) {
  const { redirect, erro } = await searchParams;
  const configured = isSupabaseConfigured();
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#1a2b47] via-[#1f3558] to-[#2e5080] px-14 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-40 size-[30rem] rounded-full" style={{ border: "64px solid rgb(255 255 255 / .05)" }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-56 -left-40 size-[36rem] rounded-full bg-white/5" />
        <Image src="/logo-symbol.png" alt="" aria-hidden width={435} height={505} className="pointer-events-none absolute -bottom-16 -right-20 w-[22rem] opacity-[.06] brightness-0 invert" />

        <Image src="/logo-maisfisio-white.png" alt="MaisFisio — Serviços de Fisioterapia Hospitalar" width={703} height={467} priority className="relative h-auto w-52" />

        <div className="relative max-w-xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/5 ring-1 ring-inset ring-white/15 px-3 py-1 text-xs font-medium tracking-wide text-blue-100">MaisFisio HUB</p>
          <h1 className="font-display text-[2.9rem] font-bold leading-[1.08] tracking-[-.04em]">Cuidado que se mede.<br />Resultados que evoluem.</h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-blue-50/75">Indicadores assistenciais de todas as unidades atendidas pela MaisFisio, em um só lugar.</p>
          <ul className="mt-10 grid grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3 rounded-2xl bg-white/[.06] ring-1 ring-inset ring-white/10 p-4 backdrop-blur-sm">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10"><Icon className="size-[18px] text-blue-100" /></span>
                <span><span className="block text-sm font-semibold">{title}</span><span className="mt-0.5 block text-[13px] leading-snug text-blue-50/65">{text}</span></span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-white/45">© {new Date().getFullYear()} MaisFisio · Serviços de Fisioterapia Hospitalar</p>
      </section>

      <section className="flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-10">
        <div className="w-full max-w-[25rem]">
          <div className="mb-10 flex justify-center lg:hidden">
            <Image src="/logo-maisfisio.png" alt="MaisFisio — Serviços de Fisioterapia Hospitalar" width={703} height={467} priority className="h-auto w-48" />
          </div>
          <header className="mb-8">
            <h2 className="font-display text-[1.75rem] font-bold tracking-[-.03em]">Entrar</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">Use o e-mail cadastrado pela coordenação da sua unidade.</p>
          </header>
          <div className="grid gap-5">
            {!configured && <SetupRequired />}
            {erro && ERROR_MESSAGES[erro] && <Alert className="border-amber-200 bg-amber-50 text-amber-900">{ERROR_MESSAGES[erro]}</Alert>}
            <LoginForm redirectTo={redirect} disabled={!configured} />
          </div>
          <p className="mt-10 flex items-start gap-2 border-t pt-6 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-px size-4 shrink-0" />
            <span>Acesso restrito à equipe MaisFisio. Sem conta ou sem conseguir entrar? Fale com o gestor da sua unidade.</span>
          </p>
        </div>
      </section>
    </main>
  );
}
