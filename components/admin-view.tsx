"use client";

import { useState } from "react";
import { Building2, ClipboardList, Gauge, LoaderCircle, Pencil, Plus, Settings2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NamedDateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { ptBRDate } from "@/lib/utils";

type ServiceRow = { id: string; name: string; code?: string };
type UnitRow = { id: string; code: string; name: string };
type CollaboratorUnitRow = { collaborator_id: string; unit_id: string };
type CollaboratorRow = { id: string; canonical_name: string; service_id: string; user_id: string | null; active: boolean; services?: { name: string }[] | null };
type IndicatorRow = { id: string; name: string; kind: string; context: string; active: boolean; services?: { name: string }[] | null };
type SectorRow = { id: string; unit_id: string; code: string; name: string; context: string };
type ServiceSectorRow = { service_id: string; sector_id: string };
type TargetRow = { id: string; target_value: number; comparison: string; valid_from: string; unit_id: string | null; indicators?: { name: string }[] | null; sectors?: { name: string }[] | null; units?: { name: string }[] | null };
type AuditRow = { id: number; changed_at: string; action: string; table_name: string; record_id: string | null; profiles?: { full_name: string }[] | null };

export function AdminView({ role, currentServiceId, units, activeUnitId, services, collaborators, collaboratorUnits, indicators, sectors, serviceSectors, targets, audit }: { role: string; currentServiceId: string | null; units: UnitRow[]; activeUnitId: string | null; services: ServiceRow[]; collaborators: CollaboratorRow[]; collaboratorUnits: CollaboratorUnitRow[]; indicators: IndicatorRow[]; sectors: SectorRow[]; serviceSectors: ServiceSectorRow[]; targets: TargetRow[]; audit: AuditRow[] }) {
  const [tab, setTab] = useState("colaboradores");
  const canManageSectors = role === "super_admin" || role === "admin";
  const tabs = [{ id: "colaboradores", label: "Colaboradores", icon: Users }, ...(role === "super_admin" ? [{ id: "unidades", label: "Unidades", icon: Building2 }] : []), ...(canManageSectors ? [{ id: "setores", label: "Setores", icon: Building2 }] : []), { id: "metas", label: "Metas", icon: Gauge }, { id: "indicadores", label: "Indicadores", icon: Settings2 }, { id: "auditoria", label: "Auditoria", icon: ClipboardList }];
  return <div className="grid gap-6"><header><h1 className="page-title">Administração</h1><p className="page-description">Gerencie unidades, acessos e catálogos do sistema.</p></header><div className="flex gap-2 overflow-x-auto pb-1">{tabs.map(({ id, label, icon: Icon }) => <Button key={id} variant={tab === id ? "default" : "outline"} onClick={() => setTab(id)}><Icon className="size-4" />{label}</Button>)}</div>{tab === "colaboradores" && <Collaborators role={role} currentServiceId={currentServiceId} units={units} activeUnitId={activeUnitId} services={services} collaborators={collaborators} collaboratorUnits={collaboratorUnits} />}{tab === "unidades" && <Units units={units} sectors={sectors} />}{tab === "setores" && <Sectors units={units} activeUnitId={activeUnitId} services={services} sectors={sectors} serviceSectors={serviceSectors} />}{tab === "metas" && <Targets role={role} units={units} activeUnitId={activeUnitId} indicators={indicators} sectors={sectors} targets={targets} />}{tab === "indicadores" && <Indicators indicators={indicators} />}{tab === "auditoria" && <Audit rows={audit} />}</div>;
}

// Portal da matriz: criar unidades e acompanhar seus setores. Setores são
// cadastrados por unidade; os catálogos clínicos permanecem globais.
function Units({ units, sectors }: { units: UnitRow[]; sectors: SectorRow[] }) {
  const [pending, setPending] = useState(false);
  async function createUnit(formData: FormData) {
    setPending(true);
    const name = String(formData.get("name") ?? "").trim();
    const code = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const { error } = await createClient().from("units").insert({ name, code });
    setPending(false);
    if (error) toast.error(error.message); else { toast.success("Unidade criada."); location.reload(); }
  }
  return <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
    <div className="grid gap-6">
      <Card><CardHeader><CardTitle>Nova unidade</CardTitle><CardDescription>Hospitais e unidades atendidas pela MaisFisio.</CardDescription></CardHeader><CardContent><form action={createUnit} className="grid gap-4"><div className="field"><Label>Nome da unidade</Label><Input name="name" required placeholder="Ex.: Hospital Santa Terezinha" /></div><Button disabled={pending}>{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}Criar unidade</Button></form></CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>Unidades e setores</CardTitle><CardDescription>{units.length} unidades ativas</CardDescription></CardHeader><CardContent className="divide-y p-0">{units.map((unit) => { const unitSectors = sectors.filter((x) => x.unit_id === unit.id); return <div key={unit.id} className="px-5 py-4 md:px-6"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-xl bg-secondary text-primary"><Building2 className="size-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{unit.name}</p><p className="text-xs text-muted-foreground">{unitSectors.length ? unitSectors.map((x) => x.name).join(" · ") : "Nenhum setor cadastrado ainda"}</p></div><Badge>{unitSectors.length} setores</Badge></div></div>; })}</CardContent></Card>
  </div>;
}

function Sectors({ units, activeUnitId, services, sectors, serviceSectors }: { units: UnitRow[]; activeUnitId: string | null; services: ServiceRow[]; sectors: SectorRow[]; serviceSectors: ServiceSectorRow[] }) {
  const [editing, setEditing] = useState<SectorRow | null>(null);
  const [pending, setPending] = useState(false);
  const serviceNames = new Map(services.map((service) => [service.id, service.name]));

  async function save(formData: FormData) {
    const serviceIds = formData.getAll("service_ids").map(String);
    if (!serviceIds.length) {
      toast.error("Selecione ao menos um serviço.");
      return;
    }

    setPending(true);
    const { error } = await createClient().rpc("save_sector_with_services", {
      p_sector_id: formData.get("sector_id") || null,
      p_unit_id: formData.get("unit_id"),
      p_name: formData.get("name"),
      p_context: formData.get("context"),
      p_service_ids: serviceIds,
    });
    setPending(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(editing ? "Setor atualizado." : "Setor criado.");
    location.reload();
  }

  const enabledServices = (sectorId: string) => serviceSectors
    .filter((link) => link.sector_id === sectorId)
    .map((link) => link.service_id);

  return <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
    <Card className="h-fit">
      <CardHeader><CardTitle>{editing ? "Editar setor" : "Novo setor"}</CardTitle><CardDescription>Defina em quais serviços este setor aparecerá nos formulários.</CardDescription></CardHeader>
      <CardContent><form key={editing?.id ?? "new"} action={save} className="grid gap-4">
        <input type="hidden" name="sector_id" value={editing?.id ?? ""} />
        <div className="field"><Label>Unidade</Label>{editing ? <><Select value={editing.unit_id} disabled><option value={editing.unit_id}>{units.find((unit) => unit.id === editing.unit_id)?.name}</option></Select><input type="hidden" name="unit_id" value={editing.unit_id} /></> : <Select name="unit_id" defaultValue={activeUnitId ?? units[0]?.id ?? ""} required>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</Select>}</div>
        <div className="field"><Label>Nome do setor</Label><Input name="name" required defaultValue={editing?.name} placeholder="Ex.: Enfermaria Norte" /></div>
        <div className="field"><Label>Contexto</Label><Select name="context" defaultValue={editing?.context ?? "enfermaria"}><option value="enfermaria">Enfermaria</option><option value="clinica">Clínica</option><option value="uti">UTI</option><option value="ambulatorio">Ambulatório</option></Select></div>
        <fieldset className="grid gap-2"><legend className="mb-1 text-sm font-medium">Serviços habilitados</legend>{services.map((service) => <label key={service.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm"><input type="checkbox" name="service_ids" value={service.id} defaultChecked={editing ? enabledServices(editing.id).includes(service.id) : false} className="size-4 accent-primary" /><span>{service.name}</span></label>)}</fieldset>
        <div className="flex gap-2"><Button disabled={pending} className="flex-1">{pending ? <LoaderCircle className="size-4 animate-spin" /> : editing ? <Pencil className="size-4" /> : <Plus className="size-4" />}{pending ? "Salvando..." : editing ? "Salvar alterações" : "Criar setor"}</Button>{editing && <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>}</div>
      </form></CardContent>
    </Card>
    <Card><CardHeader><CardTitle>Setores cadastrados</CardTitle><CardDescription>{sectors.length} setores nas unidades disponíveis</CardDescription></CardHeader><CardContent className="divide-y p-0">{sectors.map((sector) => { const serviceIds = enabledServices(sector.id); return <div key={sector.id} className="flex items-start gap-3 px-5 py-4 md:px-6"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{sector.name}</p><p className="mt-1 text-xs text-muted-foreground">{units.find((unit) => unit.id === sector.unit_id)?.name} · {sector.context ?? "contexto não informado"}</p><div className="mt-2 flex flex-wrap gap-1.5">{serviceIds.map((serviceId) => <Badge key={serviceId} className="bg-secondary text-secondary-foreground">{serviceNames.get(serviceId) ?? "Serviço"}</Badge>)}{!serviceIds.length && <Badge className="bg-amber-100 text-amber-700">Sem serviço habilitado</Badge>}</div></div><Button type="button" size="sm" variant="outline" onClick={() => setEditing(sector)}><Pencil className="size-4" />Editar</Button></div>; })}{!sectors.length && <p className="p-6 text-sm text-muted-foreground">Nenhum setor cadastrado.</p>}</CardContent></Card>
  </div>;
}

function Collaborators({ role, currentServiceId, units, activeUnitId, services, collaborators, collaboratorUnits }: { role: string; currentServiceId: string | null; units: UnitRow[]; activeUnitId: string | null; services: ServiceRow[]; collaborators: CollaboratorRow[]; collaboratorUnits: CollaboratorUnitRow[] }) {
  const [pending, setPending] = useState(false);
  const unitNames = new Map(units.map((x) => [x.id, x.name]));
  async function invite(formData: FormData) { setPending(true); const body = Object.fromEntries(formData); const response = await fetch("/api/admin/invite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const data = await response.json(); setPending(false); if (!response.ok) { toast.error(data.error); return; } toast.success("Convite enviado por e-mail."); }
  return <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]"><Card><CardHeader><CardTitle>Convidar usuário</CardTitle><CardDescription>O acesso só é criado após o convite institucional.</CardDescription></CardHeader><CardContent><form action={invite} className="grid gap-4"><div className="field"><Label>Nome completo do profissional</Label><Input name="full_name" required /></div><div className="field"><Label>E-mail</Label><Input name="email" type="email" required /></div><div className="field"><Label>Unidade</Label><Select name="unit_id" defaultValue={activeUnitId ?? units[0]?.id ?? ""} required>{units.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></div><div className="field"><Label>Serviço</Label><Select name="service_id" defaultValue={currentServiceId ?? ""} disabled={role === "coordenador"}>{services.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>{role === "coordenador" && <input type="hidden" name="service_id" value={currentServiceId ?? ""} />}</div><div className="field"><Label>Papel</Label><Select name="role" disabled={role === "coordenador"}><option value="colaborador">Colaborador</option>{(role === "admin" || role === "super_admin") && <><option value="coordenador">Coordenador</option><option value="admin">Administrador</option></>}</Select>{role === "coordenador" && <input type="hidden" name="role" value="colaborador" />}</div><Button disabled={pending}>{pending ? <LoaderCircle className="size-4 animate-spin" /> : <UserPlus className="size-4" />}{pending ? "Enviando..." : "Enviar convite"}</Button></form></CardContent></Card><Card><CardHeader><CardTitle>Profissionais cadastrados</CardTitle><CardDescription>{collaborators.length} registros canônicos</CardDescription></CardHeader><CardContent className="divide-y p-0">{collaborators.map((x) => { const unitsOf = collaboratorUnits.filter((cu) => cu.collaborator_id === x.id).map((cu) => unitNames.get(cu.unit_id)).filter(Boolean); return <div key={x.id} className="flex items-center gap-3 px-5 py-3.5 md:px-6"><div className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-bold">{x.canonical_name.slice(0, 2)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{x.canonical_name}</p><p className="truncate text-xs text-muted-foreground">{x.services?.[0]?.name ?? "Serviço"}{unitsOf.length ? ` · ${unitsOf.join(", ")}` : ""}</p></div><Badge className={x.user_id ? "" : "bg-amber-100 text-amber-700"}>{x.user_id ? "Com acesso" : "Sem acesso"}</Badge></div>; })}</CardContent></Card></div>;
}

function Targets({ role, units, activeUnitId, indicators, sectors, targets }: { role: string; units: UnitRow[]; activeUnitId: string | null; indicators: IndicatorRow[]; sectors: SectorRow[]; targets: TargetRow[] }) {
  const [pending, setPending] = useState(false);
  // unit_id nulo (meta global) só é aceito pela RLS quando o autor é super_admin.
  async function save(formData: FormData) { setPending(true); const { data: { user } } = await createClient().auth.getUser(); const payload = { indicator_id: formData.get("indicator_id"), unit_id: formData.get("unit_id") || null, sector_id: formData.get("sector_id") || null, target_value: Number(formData.get("target_value")), comparison: formData.get("comparison"), valid_from: formData.get("valid_from"), valid_until: formData.get("valid_until") || null, created_by: user!.id }; const { error } = await createClient().from("indicator_targets").insert(payload); setPending(false); if (error) toast.error(error.message); else { toast.success("Meta cadastrada."); location.reload(); } }
  return <div className="grid gap-6 xl:grid-cols-[.85fr_1.15fr]"><Card><CardHeader><CardTitle>Nova meta</CardTitle><CardDescription>Defina mínimo ou máximo por indicador e período.</CardDescription></CardHeader><CardContent><form action={save} className="grid gap-4"><div className="field"><Label>Indicador</Label><Select name="indicator_id" required>{indicators.filter((x) => x.kind !== "texto").map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></div>{role === "super_admin" ? <div className="field"><Label>Unidade</Label><Select name="unit_id" defaultValue={activeUnitId ?? ""}><option value="">Global (todas as unidades)</option>{units.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></div> : units.length > 1 ? <div className="field"><Label>Unidade</Label><Select name="unit_id" defaultValue={activeUnitId ?? units[0]?.id}>{units.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></div> : <input type="hidden" name="unit_id" value={activeUnitId ?? units[0]?.id ?? ""} />}<div className="field"><Label>Setor (opcional)</Label><Select name="sector_id"><option value="">Todos os setores</option>{sectors.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></div><div className="grid grid-cols-2 gap-3"><div className="field"><Label>Comparação</Label><Select name="comparison"><option value="minimo">Mínimo</option><option value="maximo">Máximo</option></Select></div><div className="field"><Label>Valor-alvo</Label><Input name="target_value" type="number" min="0" step="0.01" required /></div></div><div className="grid grid-cols-2 gap-3"><div className="field"><Label>Válida desde</Label><NamedDateField name="valid_from" /></div><div className="field"><Label>Até (opcional)</Label><NamedDateField name="valid_until" /></div></div><Button disabled={pending}><Plus className="size-4" />Cadastrar meta</Button></form></CardContent></Card><Card><CardHeader><CardTitle>Metas vigentes e históricas</CardTitle></CardHeader><CardContent className="divide-y p-0">{targets.map((x) => <div key={x.id} className="px-5 py-4 md:px-6"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{x.indicators?.[0]?.name}</p><p className="mt-1 text-xs text-muted-foreground">{x.units?.[0]?.name ?? "Global"} · {x.sectors?.[0]?.name ?? "Todos os setores"} · desde {ptBRDate.format(new Date(`${x.valid_from}T00:00:00Z`))}</p></div><Badge>{x.comparison === "minimo" ? "≥" : "≤"} {x.target_value}</Badge></div></div>)}{!targets.length && <p className="p-6 text-sm text-muted-foreground">Nenhuma meta cadastrada.</p>}</CardContent></Card></div>;
}

function Indicators({ indicators }: { indicators: IndicatorRow[] }) { async function toggle(id: string, active: boolean) { const { error } = await createClient().from("indicators").update({ active: !active }).eq("id", id); if (error) toast.error(error.message); else location.reload(); } return <Card><CardHeader><CardTitle>Catálogo de indicadores</CardTitle><CardDescription>Indicadores são dados: ativar ou desativar não exige alterar o banco.</CardDescription></CardHeader><CardContent className="divide-y p-0">{indicators.map((x) => <div key={x.id} className="flex items-center gap-4 px-5 py-3 md:px-6"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{x.name}</p><p className="text-xs text-muted-foreground">{x.services?.[0]?.name} · {x.context} · {x.kind}</p></div><Button size="sm" variant={x.active ? "outline" : "secondary"} onClick={() => toggle(x.id, x.active)}>{x.active ? "Desativar" : "Ativar"}</Button></div>)}</CardContent></Card>; }

function Audit({ rows }: { rows: AuditRow[] }) { const action: Record<string, string> = { INSERT: "Criação", UPDATE: "Alteração", DELETE: "Exclusão" }; return <Card><CardHeader><CardTitle>Trilha de auditoria</CardTitle><CardDescription>Últimas 100 alterações sensíveis.</CardDescription></CardHeader><CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-y bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-6 py-3">Data</th><th className="px-6 py-3">Ação</th><th className="px-6 py-3">Entidade</th><th className="px-6 py-3">Responsável</th><th className="px-6 py-3">Registro</th></tr></thead><tbody className="divide-y">{rows.map((x) => <tr key={x.id}><td className="whitespace-nowrap px-6 py-3">{new Date(x.changed_at).toLocaleString("pt-BR")}</td><td className="px-6 py-3"><Badge>{action[x.action]}</Badge></td><td className="px-6 py-3">{x.table_name}</td><td className="px-6 py-3">{x.profiles?.[0]?.full_name ?? "Sistema"}</td><td className="max-w-40 truncate px-6 py-3 font-mono text-xs">{x.record_id}</td></tr>)}</tbody></table></CardContent></Card>; }
