"use client";

import { AlertTriangle, CheckCircle2, FileSpreadsheet, LoaderCircle, Pencil, ShieldAlert, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { REASON_LABELS, SCALE_INFO, monthShort, rate, type PendingEntry, type PendingExit, type QualityReason, type ScaleQuality } from "@/lib/scale-bi";
import { createClient } from "@/lib/supabase/client";
import type { ScaleType } from "@/lib/types";
import { cn, friendlyError, ptBRNumber } from "@/lib/utils";

const br = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
const n = (v: number) => ptBRNumber.format(v);
const pct = (v: number | null) => (v === null ? "—" : `${ptBRNumber.format(v)}%`);

type Tab = "antigas" | "recentes" | "saidas";
type Option = { id: string; name: string };

export function ScaleQualitySection({ scale, data, sectors, collaborators, today, unitName, period }: { scale: ScaleType; data: ScaleQuality; sectors: Option[]; collaborators: Option[]; today: string; unitName: string; period: { de: string; ate: string } }) {
  const r = data.resumo;
  const [tab, setTab] = useState<Tab>(r.em_aberto_antiga ? "antigas" : r.saidas_sem_entrada ? "saidas" : "recentes");
  const [limit, setLimit] = useState(25);
  const [editing, setEditing] = useState<string | null>(null);
  const entries = data.entradas_pendentes.filter((e) => (tab === "antigas" ? e.situacao === "antiga" : e.situacao === "recente"));
  const rows: Array<PendingEntry | PendingExit> = tab === "saidas" ? data.saidas_pendentes : entries;
  const totalForTab = tab === "antigas" ? r.em_aberto_antiga : tab === "recentes" ? r.em_aberto_recente : r.saidas_sem_entrada;
  const clean = r.entradas_sem_saida === 0 && r.saidas_sem_entrada === 0;

  return <section className="grid grid-cols-1 gap-4" aria-labelledby="quality-title">
    <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-6">
      <div>
        <h2 id="quality-title" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight"><ShieldAlert className="size-5 text-amber-600" />Qualidade dos registros</h2>
        <p className="page-description">Entradas sem saída e saídas sem entrada de {SCALE_INFO[scale].short}. Visível só para administradores, que podem corrigir erros de lançamento; toda correção fica na auditoria.</p>
      </div>
      {!clean && <ExportPending scale={scale} data={data} unitName={unitName} period={period} />}
    </div>

    {clean ? <Card><CardContent className="flex items-center gap-3 pt-5 text-sm"><CheckCircle2 className="size-5 text-emerald-600" />Todas as entradas têm saída e todas as saídas têm entrada no período.</CardContent></Card> : <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <QualityCard tone="warn" label="Entradas sem saída há mais de 30 dias" value={n(r.em_aberto_antiga)} hint={`Provável saída não registrada · ${pct(rate(r.em_aberto_antiga, r.entradas))} das ${n(r.entradas)} entradas`} />
        <QualityCard label={`Entradas em aberto (até ${r.dias_limite} dias)`} value={n(r.em_aberto_recente)} hint="Paciente pode ainda estar internado" />
        <QualityCard tone="bad" label="Saídas sem entrada" value={n(r.saidas_sem_entrada)} hint={`${pct(rate(r.saidas_sem_entrada, r.saidas))} das ${n(r.saidas)} saídas · ficam fora da taxa de melhora`} />
      </div>

      {r.saidas_sem_entrada > 0 && <Card><CardContent className="grid gap-2 pt-5 md:grid-cols-2">
        {(Object.keys(REASON_LABELS) as QualityReason[]).filter((k) => r.motivos[k]).map((k) => <div key={k} className="flex items-start justify-between gap-3 rounded-xl border p-3">
          <div><p className="text-sm font-semibold">{REASON_LABELS[k].label}</p><p className="text-xs text-muted-foreground">{REASON_LABELS[k].hint}</p></div>
          <span className="font-display text-xl font-bold tabular-nums">{n(r.motivos[k] ?? 0)}</span>
        </div>)}
        <p className="text-xs text-muted-foreground md:col-span-2">Saídas logo no começo do período podem ter a entrada antes do primeiro dado carregado no sistema (01/01/2026).</p>
      </CardContent></Card>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Pendências por mês</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[480px] text-sm">
            <thead className="border-y bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-2.5 text-left">Mês</th><th className="px-3 py-2.5 text-right">Entradas</th><th className="px-3 py-2.5 text-right">Sem saída</th><th className="px-3 py-2.5 text-right">Saídas</th><th className="px-5 py-2.5 text-right">Sem entrada</th></tr></thead>
            <tbody className="divide-y">{data.mensal.map((m) => <tr key={m.mes}><td className="px-5 py-2 font-medium">{monthShort(m.mes)}</td><td className="px-3 py-2 text-right tabular-nums">{n(m.entradas)}</td><td className="px-3 py-2 text-right tabular-nums">{m.entradas_sem_saida ? <b className="text-amber-700">{n(m.entradas_sem_saida)}</b> : "—"} <span className="text-xs text-muted-foreground">{pct(rate(m.entradas_sem_saida, m.entradas))}</span></td><td className="px-3 py-2 text-right tabular-nums">{n(m.saidas)}</td><td className="px-5 py-2 text-right tabular-nums">{m.saidas_sem_entrada ? <b className="text-red-700">{n(m.saidas_sem_entrada)}</b> : "—"} <span className="text-xs text-muted-foreground">{pct(rate(m.saidas_sem_entrada, m.saidas))}</span></td></tr>)}</tbody>
          </table></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Pendências por setor</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0"><table className="w-full min-w-[440px] text-sm">
            <thead className="border-y bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-2.5 text-left">Setor</th><th className="px-3 py-2.5 text-right">Entradas sem saída</th><th className="px-3 py-2.5 text-right">Há mais de {r.dias_limite} dias</th><th className="px-5 py-2.5 text-right">Saídas sem entrada</th></tr></thead>
            <tbody className="divide-y">{data.setores.map((s) => <tr key={s.setor}><td className="px-5 py-2 font-medium">{s.setor}</td><td className="px-3 py-2 text-right tabular-nums">{n(s.entradas_sem_saida)}</td><td className="px-3 py-2 text-right tabular-nums text-amber-700">{n(s.em_aberto_antiga)}</td><td className="px-5 py-2 text-right tabular-nums text-red-700">{n(s.saidas_sem_entrada)}</td></tr>)}</tbody>
          </table></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div><CardTitle>Lista para correção</CardTitle><CardDescription>Abra “Corrigir” para ajustar data, momento, atendimento, setor ou profissional, ou excluir um lançamento duplicado. O motivo é obrigatório.</CardDescription></div>
          <div className="flex flex-wrap gap-2">
            {([["antigas", `Sem saída > ${r.dias_limite} dias`, r.em_aberto_antiga], ["recentes", "Em aberto recentes", r.em_aberto_recente], ["saidas", "Saídas sem entrada", r.saidas_sem_entrada]] as const).map(([id, label, count]) => <Button key={id} size="sm" variant={tab === id ? "default" : "outline"} onClick={() => { setTab(id); setLimit(25); setEditing(null); }}>{label} <span className="rounded-full bg-black/10 px-1.5 text-xs tabular-nums">{n(count)}</span></Button>)}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {rows.length === 0 ? <p className="px-6 pb-6 text-sm text-muted-foreground">Nada pendente nesta lista.</p> : <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-y bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-2.5">Data</th><th className="px-3 py-2.5">Paciente</th><th className="px-3 py-2.5">Atendimento</th><th className="px-3 py-2.5">Setor</th><th className="px-3 py-2.5">{tab === "saidas" ? "Motivo provável" : "Em aberto"}</th><th className="px-5 py-2.5 text-right">Ação</th></tr></thead>
            <tbody className="divide-y">{rows.slice(0, limit).map((row) => <Fragment key={row.id}>
              <tr className={cn(editing === row.id && "bg-muted/30")}>
                <td className="whitespace-nowrap px-5 py-2.5 tabular-nums">{br(row.data)}</td>
                <td className="px-3 py-2.5"><span className="font-medium">{row.iniciais}</span> <span className="text-muted-foreground">· pront. {row.prontuario}</span></td>
                <td className="px-3 py-2.5 tabular-nums">{row.atendimento ?? "—"}</td>
                <td className="px-3 py-2.5">{row.setor ?? "—"}</td>
                <td className="px-3 py-2.5">{"motivo" in row
                  ? <span className="grid gap-0.5"><Badge className={cn("w-fit border", row.motivo === "sem_entrada" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800")}>{REASON_LABELS[row.motivo].label}</Badge>{row.outro_atendimento && <span className="text-xs text-muted-foreground">entrada em {br(row.outra_data)} · atend. {row.outro_atendimento}</span>}</span>
                  : <span className={cn("tabular-nums", row.situacao === "antiga" && "font-semibold text-amber-700")}>{n(row.dias)} dias</span>}</td>
                <td className="px-5 py-2.5 text-right"><Button size="sm" variant="outline" onClick={() => setEditing(editing === row.id ? null : row.id)}>{editing === row.id ? <X className="size-4" /> : <Pencil className="size-4" />}{editing === row.id ? "Fechar" : "Corrigir"}</Button></td>
              </tr>
              {editing === row.id && <tr className="bg-muted/20"><td colSpan={6} className="px-5 pb-5 pt-2"><CorrectionForm row={row} isExit={tab === "saidas"} sectors={sectors} collaborators={collaborators} today={today} onDone={() => setEditing(null)} /></td></tr>}
            </Fragment>)}</tbody>
          </table>}
          {rows.length > limit && <div className="border-t p-4 text-center"><Button variant="ghost" onClick={() => setLimit((l) => l + 50)}>Mostrar mais ({n(rows.length - limit)} restantes)</Button></div>}
          {totalForTab > rows.length && <p className="border-t px-5 py-3 text-xs text-muted-foreground">A lista mostra as {n(rows.length)} mais relevantes de {n(totalForTab)}. Use o filtro de período ou de setor para ver as demais, ou exporte para Excel.</p>}
        </CardContent>
      </Card>
    </>}
  </section>;
}

function QualityCard({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "warn" | "bad" }) {
  return <Card className={cn(tone === "warn" && "border-amber-200", tone === "bad" && "border-red-200")}><CardContent className="grid gap-1.5 pt-5">
    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tone && <AlertTriangle className={cn("size-3.5", tone === "warn" ? "text-amber-600" : "text-red-600")} />}{label}</p>
    <p className={cn("font-display text-3xl font-bold tabular-nums", tone === "warn" && "text-amber-700", tone === "bad" && "text-red-700")}>{value}</p>
    <p className="text-xs text-muted-foreground">{hint}</p>
  </CardContent></Card>;
}

function CorrectionForm({ row, isExit, sectors, collaborators, today, onDone }: { row: PendingEntry | PendingExit; isExit: boolean; sectors: Option[]; collaborators: Option[]; today: string; onDone: () => void }) {
  const router = useRouter();
  const [date, setDate] = useState(row.data);
  const [moment, setMoment] = useState<"entrada" | "saida">(isExit ? "saida" : "entrada");
  const [attendance, setAttendance] = useState(row.atendimento ?? "");
  const [sector, setSector] = useState(row.setor_id);
  const [collaborator, setCollaborator] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const suggestion = "motivo" in row && row.motivo === "outro_atendimento" ? row.outro_atendimento : null;

  async function send(remove: boolean) {
    if (reason.trim().length < 5) { toast.error("Descreva o motivo da correção (mínimo 5 caracteres)."); return; }
    if (!remove && !date) { toast.error("Data inválida."); return; }
    if (remove && !window.confirm(`Excluir a avaliação de ${row.iniciais} (pront. ${row.prontuario}) de ${br(row.data)}? A exclusão fica registrada na auditoria.`)) return;
    const changes: Record<string, unknown> = remove ? { delete: true } : {};
    if (!remove) {
      if (date !== row.data) changes.assessment_date = date;
      if (moment !== (isExit ? "saida" : "entrada")) changes.moment = moment;
      if (attendance.trim() !== (row.atendimento ?? "")) changes.attendance_number = attendance.trim();
      if (sector !== row.setor_id) changes.sector_id = sector;
      if (collaborator) changes.collaborator_id = collaborator;
      if (!Object.keys(changes).length) { toast.error("Nenhum campo foi alterado."); return; }
    }
    setBusy(remove ? "delete" : "save");
    const { error } = await createClient().rpc("admin_correct_scale_assessment", { p_id: row.id, p_changes: changes, p_reason: reason.trim() });
    setBusy(null);
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success(remove ? "Avaliação excluída." : "Correção salva.");
    onDone();
    router.refresh();
  }

  return <div className="grid gap-4 rounded-xl border bg-background p-4">
    {suggestion && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"><span>A entrada deste paciente está com o atendimento <b>{suggestion}</b>.</span><Button size="sm" variant="outline" onClick={() => setAttendance(suggestion)}>Usar atendimento {suggestion}</Button></div>}
    <div className="form-grid">
      <div className="field col-span-3"><label className="text-xs font-semibold text-muted-foreground">Data da avaliação</label><DateField iso={row.data} onIso={setDate} maxIso={today} /></div>
      <div className="field col-span-2"><label className="text-xs font-semibold text-muted-foreground">Momento</label><Select value={moment} onChange={(e) => setMoment(e.target.value as "entrada" | "saida")}><option value="entrada">Entrada</option><option value="saida">Saída</option></Select></div>
      <div className="field col-span-2"><label className="text-xs font-semibold text-muted-foreground">Atendimento</label><Input value={attendance} onChange={(e) => setAttendance(e.target.value)} maxLength={50} /></div>
      <div className="field col-span-2"><label className="text-xs font-semibold text-muted-foreground">Setor</label><Select value={sector} onChange={(e) => setSector(e.target.value)}>{sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
      <div className="field col-span-3"><label className="text-xs font-semibold text-muted-foreground">Profissional</label><Select value={collaborator} onChange={(e) => setCollaborator(e.target.value)}><option value="">Manter</option>{collaborators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
      <div className="field col-span-12"><label className="text-xs font-semibold text-muted-foreground">Motivo da correção (obrigatório)</label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={2} placeholder="Ex.: atendimento digitado errado na saída; conferido no prontuário." /></div>
    </div>
    <div className="flex flex-wrap justify-between gap-2">
      <Button variant="destructive" size="sm" onClick={() => send(true)} disabled={busy !== null}>{busy === "delete" ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}Excluir avaliação</Button>
      <div className="flex gap-2"><Button variant="ghost" size="sm" onClick={onDone} disabled={busy !== null}>Cancelar</Button><Button size="sm" onClick={() => send(false)} disabled={busy !== null}>{busy === "save" ? <LoaderCircle className="size-4 animate-spin" /> : <Pencil className="size-4" />}Salvar correção</Button></div>
    </div>
  </div>;
}

function ExportPending({ scale, data, unitName, period }: { scale: ScaleType; data: ScaleQuality; unitName: string; period: { de: string; ate: string } }) {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const head = [[`Pendências de ${SCALE_INFO[scale].name} — ${unitName}`], [`Período: ${br(period.de)} a ${br(period.ate)}`], []];
      const e = XLSX.utils.aoa_to_sheet([...head, ["Data da entrada", "Iniciais", "Prontuário", "Atendimento", "Setor", "Dias em aberto", "Situação"], ...data.entradas_pendentes.map((x) => [br(x.data), x.iniciais, x.prontuario, x.atendimento ?? "", x.setor ?? "", x.dias, x.situacao === "antiga" ? "Provável saída não registrada" : "Pode estar internado"])]);
      e["!cols"] = [16, 12, 12, 13, 22, 14, 30].map((wch) => ({ wch }));
      XLSX.utils.book_append_sheet(wb, e, "Entradas sem saída");
      const s = XLSX.utils.aoa_to_sheet([...head, ["Data da saída", "Iniciais", "Prontuário", "Atendimento", "Setor", "Motivo provável", "Atendimento da entrada encontrada", "Data dessa entrada"], ...data.saidas_pendentes.map((x) => [br(x.data), x.iniciais, x.prontuario, x.atendimento ?? "", x.setor ?? "", REASON_LABELS[x.motivo].label, x.outro_atendimento ?? "", br(x.outra_data)])]);
      s["!cols"] = [14, 12, 12, 13, 22, 32, 18, 16].map((wch) => ({ wch }));
      XLSX.utils.book_append_sheet(wb, s, "Saídas sem entrada");
      XLSX.writeFile(wb, `maisfisio-pendencias-${scale}-${period.de}-a-${period.ate}.xlsx`);
    } catch (err) {
      toast.error(`Não foi possível exportar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }
  return <Button variant="outline" onClick={run} disabled={busy}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}Exportar pendências</Button>;
}
