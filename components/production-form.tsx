"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, LoaderCircle, Save } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import type { Collaborator, CollaboratorUnit, Indicator, Sector, Service, Unit } from "@/lib/types";
import { friendlyError, todayISO } from "@/lib/utils";
import { productionSchema } from "@/lib/validation";

type Values = z.infer<typeof productionSchema>;
const DRAFT_KEY = "maisfisio:production-draft";

export function ProductionForm({ units, defaultUnitId, services, sectors, serviceSectors, collaborators, collaboratorUnits, indicators, defaultServiceId, lockService }: { units: Unit[]; defaultUnitId?: string; services: Service[]; sectors: Sector[]; serviceSectors: { service_id: string; sector_id: string }[]; collaborators: Collaborator[]; collaboratorUnits: CollaboratorUnit[]; indicators: Indicator[]; defaultServiceId?: string; lockService: boolean }) {
  const form = useForm<Values>({ resolver: zodResolver(productionSchema), defaultValues: { unit_id: defaultUnitId, service_id: defaultServiceId, record_date: todayISO(), shift: "MANHÃ", sector_id: "", collaborator_id: "", context: "geral", notes: "", values: [] } });
  const unitId = form.watch("unit_id"); const serviceId = form.watch("service_id"); const context = form.watch("context");
  const contexts = useMemo(() => [...new Set(indicators.filter((i) => i.service_id === serviceId).map((i) => i.context))], [indicators, serviceId]);
  const visibleIndicators = indicators.filter((i) => i.service_id === serviceId && i.context === context);
  const unitCollaboratorIds = useMemo(() => new Set(collaboratorUnits.filter((x) => x.unit_id === unitId).map((x) => x.collaborator_id)), [collaboratorUnits, unitId]);
  const allowedSectorIds = new Set(serviceSectors.filter((x) => x.service_id === serviceId).map((x) => x.sector_id));

  useEffect(() => { if (!contexts.includes(context) && contexts[0]) form.setValue("context", contexts[0]); }, [contexts, context, form]);
  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY); if (!raw) return;
    try { const draft = JSON.parse(raw); if (draft.service_id && confirm("Há um rascunho de produção neste dispositivo. Deseja restaurá-lo?")) form.reset(draft); } catch { localStorage.removeItem(DRAFT_KEY); }
  }, [form]);
  useEffect(() => { const subscription = form.watch((value) => localStorage.setItem(DRAFT_KEY, JSON.stringify(value))); return () => subscription.unsubscribe(); }, [form]);

  async function submit(values: Values) {
    const supabase = createClient();
    const payload = { ...values, values: visibleIndicators.map((indicator) => ({ indicator_id: indicator.id, value: String((values.values as { indicator_id: string; value: string }[])?.find((x) => x.indicator_id === indicator.id)?.value ?? "") })).filter((x) => x.value !== "") };
    const { error } = await supabase.rpc("save_production_record", { payload });
    if (error) { toast.error(friendlyError(error)); return; }
    localStorage.removeItem(DRAFT_KEY); toast.success("Produção registrada com sucesso.");
    form.reset({ ...values, notes: "", values: [], record_date: todayISO() });
  }

  return <form onSubmit={form.handleSubmit(submit)} className="grid gap-6">
    <Card><CardHeader><CardTitle>Identificação do lançamento</CardTitle><CardDescription>Data, profissional e local do atendimento.</CardDescription></CardHeader><CardContent className="form-grid">
      {units.length > 1 ? <div className="field col-span-4"><Label>Unidade</Label><Select {...form.register("unit_id")}>{units.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></div> : <input type="hidden" {...form.register("unit_id")} />}
      <div className="field col-span-4"><Label>Serviço</Label><Select {...form.register("service_id")} disabled={lockService}><option value="">Selecione</option>{services.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>{lockService && <input type="hidden" {...form.register("service_id")} />}</div>
      {contexts.length > 1 && <div className="field col-span-4"><Label>Contexto</Label><Select {...form.register("context")}><option value="geral">Atendimento geral</option><option value="enfermaria">Enfermaria</option><option value="ambulatorio">Ambulatório</option><option value="uti">UTI</option></Select></div>}
      <div className="field col-span-4"><Label>Data</Label><Input type="date" max={todayISO()} {...form.register("record_date")} /></div>
      <div className="field col-span-4"><Label>Colaborador(a)</Label><Select {...form.register("collaborator_id")}><option value="">Selecione</option>{collaborators.filter((x) => x.service_id === serviceId && unitCollaboratorIds.has(x.id)).map((x) => <option key={x.id} value={x.id}>{x.canonical_name}</option>)}</Select></div>
      <div className="field col-span-3"><Label>Turno</Label><Select {...form.register("shift")}><option>MANHÃ</option><option>TARDE</option><option>NOITE</option></Select></div>
      <div className="field col-span-3"><Label>Setor</Label><Select {...form.register("sector_id")}><option value="">Selecione</option>{sectors.filter((x) => x.unit_id === unitId && allowedSectorIds.has(x.id)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></div>
      <div className="field col-span-2"><Label>Tipo de setor</Label><Select {...form.register("sector_type")}><option value="">Não se aplica</option><option>Médica</option><option>Ortopédica</option><option>Cirúrgica</option></Select></div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Indicadores</CardTitle><CardDescription>Deixe em branco apenas quando o dado não se aplicar; use zero quando o resultado for zero.</CardDescription></CardHeader><CardContent>
      {visibleIndicators.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visibleIndicators.map((indicator, index) => <div className="field" key={indicator.id}><Label htmlFor={indicator.id} className="min-h-9 leading-snug">{indicator.name}</Label>{indicator.kind === "texto" ? <Textarea id={indicator.id} {...form.register(`values.${index}.value`)} /> : <div className="relative"><Input id={indicator.id} type="number" min="0" step={indicator.kind === "taxa" ? "0.01" : "1"} inputMode="decimal" className="pr-12" {...form.register(`values.${index}.value`)} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{indicator.kind === "taxa" ? "%" : "un."}</span></div>}<input type="hidden" value={indicator.id} {...form.register(`values.${index}.indicator_id`)} /></div>)}</div> : <Alert>Selecione um serviço com indicadores ativos.</Alert>}
    </CardContent></Card>
    <Card><CardContent className="grid gap-5 pt-5 md:pt-6"><div className="field"><Label>Observações (opcional)</Label><Textarea {...form.register("notes")} placeholder="Registre somente informações assistenciais necessárias, sem nome completo de paciente." /></div>{Object.keys(form.formState.errors).length > 0 && <Alert className="border-red-200 bg-red-50 text-red-800">Revise os campos obrigatórios antes de salvar.</Alert>}<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><span className="mr-auto flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="size-4" />Rascunho salvo neste dispositivo</span><Button type="submit" size="lg" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{form.formState.isSubmitting ? "Salvando..." : "Salvar produção"}</Button></div></CardContent></Card>
  </form>;
}
