import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Building2, ChevronRight, Layers } from "lucide-react";
import { chooseUnit, logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";
import { safeRedirectTarget } from "@/lib/utils";
import { ALL_UNITS } from "@/lib/units";

export const metadata: Metadata = { title: "Escolha a unidade" };
export const dynamic = "force-dynamic";

// Depois do login: quem atua em mais de uma unidade escolhe onde vai
// trabalhar; com uma unidade só, segue direto. Fica fora do layout protegido
// (tela própria, sem menu), então repete as mesmas checagens dele.
export default async function SelectUnitPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeRedirectTarget((await searchParams).next);
  const session = await getSession();
  if (!session.userId) redirect("/login");
  if (session.profile.active === false) { await session.supabase.auth.signOut(); redirect("/login?erro=inativo"); }
  if (session.mustChangePassword) redirect("/definir-senha");

  const isMatriz = session.profile.role === "super_admin";
  if (session.units.length <= 1 && !(isMatriz && session.units.length > 1)) redirect(next);

  const firstName = session.profile.full_name.split(" ")[0];
  const options = [
    ...(isMatriz ? [{ id: ALL_UNITS, name: "Todas as unidades", hint: "Visão consolidada da matriz", icon: Layers }] : []),
    ...session.units.map((unit) => ({ id: unit.id, name: unit.name, hint: unit.id === session.activeUnitId ? "Última unidade usada" : "", icon: Building2 })),
  ];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Image src="/logo-maisfisio.png" alt="MaisFisio" width={703} height={467} priority className="h-auto w-36" /></div>
        <header className="mb-6 text-center">
          <h1 className="font-display text-2xl font-bold tracking-[-.03em]">Olá, {firstName}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Em qual unidade você vai trabalhar agora? Dá para trocar depois pelo menu.</p>
        </header>
        <ul className="grid gap-3">
          {options.map(({ id, name, hint, icon: Icon }) => (
            <li key={id}>
              <form action={chooseUnit}>
                <input type="hidden" name="unit_id" value={id} />
                <input type="hidden" name="next" value={next} />
                <button type="submit" className="group flex w-full items-center gap-4 rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Icon className="size-5" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{name}</span>{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</span>
                  <ChevronRight className="size-5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={logout} className="mt-8 text-center"><Button type="submit" variant="ghost" className="text-muted-foreground">Sair</Button></form>
      </div>
    </main>
  );
}
