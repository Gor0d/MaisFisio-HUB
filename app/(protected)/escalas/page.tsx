import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Brain, Dumbbell, PersonStanding } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Escalas clínicas" };

const scales = [
  { href: "/escalas/barthel", title: "Índice de Barthel", description: "10 atividades de vida diária · total de 0 a 100", icon: PersonStanding, color: "bg-emerald-100 text-emerald-700" },
  { href: "/escalas/mrc", title: "Escala MRC", description: "12 grupos musculares · total de 0 a 60", icon: Dumbbell, color: "bg-blue-100 text-blue-700" },
  { href: "/escalas/melhoria_uti", title: "Melhoria Funcional UTI", description: "Consciência, força, respiração e mobilidade · total de 0 a 33", icon: Brain, color: "bg-amber-100 text-amber-700" },
];

export default function ScalesPage() {
  return <div className="grid gap-6"><header><h1 className="page-title">Escalas clínicas</h1><p className="page-description">Avalie entrada e saída; totais e melhora são calculados automaticamente.</p></header><div className="grid gap-4 lg:grid-cols-3">{scales.map(({ href, title, description, icon: Icon, color }) => <Link key={href} href={href} className="group"><Card className="h-full transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"><CardContent className="flex h-full flex-col pt-5 md:pt-6"><div className={`mb-6 grid size-12 place-items-center rounded-2xl ${color}`}><Icon className="size-6" /></div><h2 className="font-display text-xl font-bold tracking-tight">{title}</h2><p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p><span className="mt-8 flex items-center gap-2 text-sm font-semibold text-primary">Nova avaliação <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span></CardContent></Card></Link>)}</div><Card className="border-dashed bg-secondary/30"><CardContent className="flex items-start gap-3 pt-5 text-sm text-muted-foreground md:pt-6"><div className="mt-1 size-2 shrink-0 rounded-full bg-primary" /><p>Para calcular a melhora, use o mesmo número de registro/prontuário (e atendimento, quando houver) nas avaliações de entrada e saída. A comparação é feita no banco, nunca digitada.</p></CardContent></Card></div>;
}
