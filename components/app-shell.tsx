"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, Building2, ClipboardPlus, FileBarChart, LogOut, Menu, Settings, X } from "lucide-react";
import { useRef, useState } from "react";
import { logout, setActiveUnit } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Profile, Unit } from "@/lib/types";

const mainNav = [
  { href: "/dashboard", label: "Visão geral", icon: BarChart3 },
  { href: "/lancamento", label: "Lançar produção", icon: ClipboardPlus },
  { href: "/escalas", label: "Escalas clínicas", icon: Activity },
  { href: "/relatorios", label: "Relatórios", icon: FileBarChart },
];

export function AppShell({ profile, units, activeUnitId, children }: { profile: Profile; units: Unit[]; activeUnitId: string | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const unitFormRef = useRef<HTMLFormElement>(null);
  const nav = profile.role === "colaborador" ? mainNav : [...mainNav, { href: "/admin", label: "Administração", icon: Settings }];

  const UnitSwitcher = () => units.length === 0 ? null : (
    <form ref={unitFormRef} action={setActiveUnit} className="border-b px-4 py-3">
      <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Building2 className="size-3.5" />Unidade</label>
      {units.length === 1 && profile.role !== "super_admin"
        ? <p className="truncate text-sm font-medium">{units[0].name}</p>
        : <Select name="unit_id" defaultValue={activeUnitId ?? "all"} onChange={() => unitFormRef.current?.requestSubmit()}>
            {profile.role === "super_admin" && <option value="all">Todas as unidades</option>}
            {units.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Select>}
    </form>
  );

  const Sidebar = () => (
    <>
      <div className="flex h-20 items-center gap-3 border-b px-5">
        <Image src="/icon.svg" width={40} height={40} alt="" className="rounded-xl" />
        <div><p className="font-display text-lg font-bold tracking-tight">MaisFisio</p><p className="text-[11px] text-muted-foreground">Indicadores assistenciais</p></div>
      </div>
      <UnitSwitcher />
      <nav className="flex-1 space-y-1 p-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return <Link key={href} href={href} onClick={() => setOpen(false)} className={cn("flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors", active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><Icon className="size-[18px]" />{label}</Link>;
        })}
      </nav>
      <div className="border-t p-3">
        <div className="mb-2 flex items-center gap-3 rounded-xl p-2">
          <div className="grid size-9 place-items-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">{profile.full_name.slice(0, 2).toUpperCase()}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{profile.full_name}</p><p className="truncate text-xs capitalize text-muted-foreground">{profile.role}</p></div>
        </div>
        <form action={logout}><Button type="submit" variant="ghost" className="w-full justify-start text-muted-foreground"><LogOut className="size-4" />Sair</Button></form>
      </div>
    </>
  );

  return (
    <div className="min-h-screen md:grid md:grid-cols-[244px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r bg-card md:flex md:flex-col"><Sidebar /></aside>
      {open && <div className="fixed inset-0 z-50 md:hidden"><button aria-label="Fechar menu" className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm" onClick={() => setOpen(false)} /><aside className="relative flex h-full w-[82%] max-w-xs flex-col bg-card shadow-2xl"><button className="absolute right-3 top-3 grid size-10 place-items-center rounded-xl" onClick={() => setOpen(false)}><X className="size-5" /></button><Sidebar /></aside></div>}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur md:hidden">
          <button className="grid size-10 place-items-center rounded-xl border bg-card" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu className="size-5" /></button>
          <div className="flex items-center gap-2"><Image src="/icon.svg" width={30} height={30} alt="" className="rounded-lg" /><span className="font-display font-bold">MaisFisio</span></div>
          <div className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">{profile.full_name.slice(0, 2).toUpperCase()}</div>
        </header>
        <main className="mx-auto w-full max-w-[1500px] p-4 pb-24 sm:p-6 lg:p-8">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-card/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {mainNav.map(({ href, label, icon: Icon }) => { const active = pathname === href || pathname.startsWith(`${href}/`); return <Link key={href} href={href} className={cn("flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-medium", active ? "text-primary" : "text-muted-foreground")}><Icon className="size-5" />{label.split(" ")[0]}</Link>; })}
      </nav>
    </div>
  );
}
