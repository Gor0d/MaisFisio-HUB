import type { Metadata } from "next";
import Image from "next/image";
import { Activity, BarChart3, ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { SetupRequired } from "@/components/setup-required";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Entrar" };

const ERROR_MESSAGES: Record<string, string> = {
  inativo: "Sua conta está inativa. Procure o administrador da sua unidade para reativar o acesso.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ redirect?: string; erro?: string }> }) {
  const { redirect, erro } = await searchParams;
  const configured = isSupabaseConfigured();
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-[#075d47] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-28 -top-32 size-[28rem] rounded-full border-[70px] border-white/5" />
        <div className="absolute -bottom-52 -left-28 size-[34rem] rounded-full bg-[#0a8964]" />
        <div className="relative flex items-center gap-3">
          <Image src="/icon.svg" alt="" width={46} height={46} className="rounded-xl" priority />
          <span className="font-display text-2xl font-bold tracking-tight">MaisFisio</span>
        </div>
        <div className="relative max-w-xl">
          <p className="font-display text-5xl font-bold leading-[1.07] tracking-[-.045em]">Cuidado que se mede.<br />Resultados que evoluem.</p>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-emerald-50/80">Indicadores assistenciais confiáveis para transformar o trabalho diário em decisões melhores.</p>
          <div className="mt-10 grid grid-cols-3 gap-4">
            {[[Activity, "Escalas calculadas"], [BarChart3, "Indicadores em tempo real"], [ShieldCheck, "Dados protegidos"]].map(([Icon, text]) => {
              const LucideIcon = Icon as typeof Activity;
              return <div key={String(text)} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur"><LucideIcon className="mb-3 size-5 text-emerald-200" /><p className="text-sm text-emerald-50/80">{String(text)}</p></div>;
            })}
          </div>
        </div>
        <p className="relative text-sm text-white/50">Hospital Público Estadual Galileu</p>
      </section>
      <section className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image src="/icon.svg" alt="" width={42} height={42} className="rounded-xl" priority />
            <span className="font-display text-xl font-bold">MaisFisio</span>
          </div>
          <Card className="border-0 bg-transparent shadow-none sm:border sm:bg-card sm:shadow-sm">
            <CardHeader className="px-0 sm:px-6">
              <CardTitle className="text-2xl">Bem-vindo de volta</CardTitle>
              <CardDescription>Use sua conta institucional para continuar.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 px-0 sm:px-6">
              {!configured && <SetupRequired />}
              {erro && ERROR_MESSAGES[erro] && <Alert className="border-amber-200 bg-amber-50 text-amber-900">{ERROR_MESSAGES[erro]}</Alert>}
              <LoginForm redirectTo={redirect} disabled={!configured} />
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
