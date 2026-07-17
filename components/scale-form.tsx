"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Calculator, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import type { Collaborator, ScaleItem, ScaleType, Sector } from "@/lib/types";
import { friendlyError, todayISO } from "@/lib/utils";
import { scaleAssessmentSchema } from "@/lib/validation";

type InputValues = z.input<typeof scaleAssessmentSchema>;
type Values = z.output<typeof scaleAssessmentSchema>;
const scaleMax: Record<ScaleType, number> = { barthel: 100, mrc: 60, melhoria_uti: 33 };

export function ScaleForm({ type, items, sectors, collaborators }: { type: ScaleType; items: ScaleItem[]; sectors: Sector[]; collaborators: Collaborator[] }) {
  const [step, setStep] = useState(1);
  const form = useForm<InputValues, unknown, Values>({ resolver: zodResolver(scaleAssessmentSchema), defaultValues: { scale_type: type, initials: "", record_number: "", assessment_date: todayISO(), moment: "entrada", sector_id: "", attendance_number: "", cid: "", notes: "", answers: items.map((item) => ({ item_id: item.id, option_id: "" })) } });
  const answers = form.watch("answers");
  const total = useMemo(() => answers.reduce((sum, answer) => { const item = items.find((x) => x.id === answer.item_id); return sum + (item?.scale_item_options.find((x) => x.id === answer.option_id)?.points ?? 0); }, 0), [answers, items]);
  const answered = answers.filter((x) => x.option_id).length;

  async function next() {
    const ok = await form.trigger(["initials", "record_number", "assessment_date", "moment", "sector_id"]); if (ok) { setStep(2); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }
  async function submit(values: Values) {
    const { error } = await createClient().rpc("save_scale_assessment", { payload: { ...values, age: values.age ? String(values.age) : "" } });
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success("Avaliação salva. O resultado já está disponível no dashboard.");
    form.reset({ ...values, initials: "", record_number: "", answers: items.map((item) => ({ item_id: item.id, option_id: "" })), assessment_date: todayISO() }); setStep(1);
  }

  return <form onSubmit={form.handleSubmit(submit)} className="grid gap-6">
    <div className="flex items-center gap-3"><div className={`grid size-8 place-items-center rounded-full text-sm font-bold ${step >= 1 ? "bg-primary text-white" : "bg-muted"}`}>1</div><div className="h-px flex-1 bg-border"><div className={`h-full bg-primary transition-all ${step === 2 ? "w-full" : "w-0"}`} /></div><div className={`grid size-8 place-items-center rounded-full text-sm font-bold ${step >= 2 ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>2</div></div>
    {step === 1 ? <Card><CardHeader><CardTitle>Dados da avaliação</CardTitle><CardDescription>Identificação mínima do paciente, conforme LGPD.</CardDescription></CardHeader><CardContent className="form-grid">
      <input type="hidden" {...form.register("scale_type")} />
      <div className="field col-span-4"><Label>Iniciais do paciente</Label><Input {...form.register("initials")} placeholder="Ex.: M. A. S." autoCapitalize="characters" /><FieldError text={form.formState.errors.initials?.message} /></div>
      <div className="field col-span-4"><Label>Nº de registro/prontuário</Label><Input {...form.register("record_number")} inputMode="numeric" /><FieldError text={form.formState.errors.record_number?.message} /></div>
      {type === "melhoria_uti" && <div className="field col-span-2"><Label>Idade</Label><Input type="number" min="0" max="130" {...form.register("age")} /></div>}
      <div className="field col-span-4"><Label>Momento</Label><Select {...form.register("moment")}><option value="entrada">Entrada</option><option value="saida">Saída</option></Select></div>
      <div className="field col-span-4"><Label>Data da avaliação</Label><Input type="date" max={todayISO()} {...form.register("assessment_date")} /></div>
      <div className="field col-span-4"><Label>Setor</Label><Select {...form.register("sector_id")}><option value="">Selecione</option>{sectors.filter((x) => type !== "melhoria_uti" || x.context === "uti").map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select><FieldError text={form.formState.errors.sector_id?.message} /></div>
      <div className="field col-span-4"><Label>Tipo de setor</Label><Select {...form.register("sector_type")}><option value="">Não informado</option><option>Médica</option><option>Ortopédica</option><option>Cirúrgica</option></Select></div>
      {type === "mrc" && <div className="field col-span-4"><Label>Número do atendimento</Label><Input {...form.register("attendance_number")} /></div>}
      {type !== "barthel" && <div className="field col-span-4"><Label>Colaborador(a)</Label><Select {...form.register("collaborator_id")}><option value="">Selecione</option>{collaborators.map((x) => <option key={x.id} value={x.id}>{x.canonical_name}</option>)}</Select></div>}
      {type === "melhoria_uti" && <><div className="field col-span-4"><Label>Diagnóstico principal (CID)</Label><Input {...form.register("cid")} /></div><div className="field col-span-4"><Label>Data de entrada/saída na UTI</Label><Input type="date" {...form.register("event_date")} /></div><div className="field col-span-12"><Label>Observações</Label><Textarea {...form.register("notes")} /></div></>}
      <Alert className="col-span-12 flex gap-3 border-emerald-200 bg-emerald-50 text-emerald-900"><ShieldCheck className="size-5 shrink-0" />Não informe o nome completo do paciente. Iniciais e prontuário são suficientes.</Alert>
      <div className="col-span-12 flex justify-between"><Button type="button" variant="ghost" onClick={() => history.back()}><ArrowLeft className="size-4" />Voltar</Button><Button type="button" onClick={next}>Continuar <ArrowRight className="size-4" /></Button></div>
    </CardContent></Card> : <>
      <div className="sticky top-16 z-20 flex items-center justify-between rounded-2xl border bg-card/95 p-4 shadow-sm backdrop-blur md:top-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pontuação atual</p><p className="font-display text-2xl font-bold">{total} <span className="text-sm font-medium text-muted-foreground">/ {scaleMax[type]}</span></p></div><Badge>{answered} de {items.length} itens</Badge></div>
      <div className={`grid gap-4 ${type === "mrc" ? "lg:grid-cols-2" : ""}`}>{items.map((item, index) => <Card key={item.id}><CardHeader className="pb-4"><div className="flex items-start justify-between gap-3"><CardTitle className="text-base">{item.display_order}. {item.name}</CardTitle><span className="shrink-0 text-xs text-muted-foreground">máx. {item.max_points}</span></div></CardHeader><CardContent><div className="grid gap-2">{item.scale_item_options.map((option) => { const selected = answers[index]?.option_id === option.id; return <label key={option.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"}`}><input type="radio" value={option.id} className="mt-1 accent-[var(--primary)]" {...form.register(`answers.${index}.option_id`)} /><input type="hidden" value={item.id} {...form.register(`answers.${index}.item_id`)} /><span className="flex-1 text-sm leading-snug">{option.label}</span><span className="font-display text-sm font-bold text-primary">{option.points}</span></label>; })}</div></CardContent></Card>)}</div>
      {form.formState.errors.answers && <Alert className="border-red-200 bg-red-50 text-red-800">Responda todos os itens antes de salvar.</Alert>}
      <Card><CardContent className="flex flex-col gap-4 pt-5 md:flex-row md:items-center md:justify-between md:pt-6"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-secondary text-primary"><Calculator className="size-5" /></div><div><p className="text-sm text-muted-foreground">Total calculado</p><p className="font-display text-xl font-bold">{total} de {scaleMax[type]} pontos</p></div></div><div className="flex gap-3"><Button type="button" variant="outline" onClick={() => setStep(1)}><ArrowLeft className="size-4" />Dados</Button><Button type="submit" size="lg" disabled={form.formState.isSubmitting || answered !== items.length}>{form.formState.isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{form.formState.isSubmitting ? "Salvando..." : "Salvar avaliação"}</Button></div></CardContent></Card>
    </>}
  </form>;
}

function FieldError({ text }: { text?: string }) { return text ? <p className="text-xs text-red-600">{text}</p> : null; }
