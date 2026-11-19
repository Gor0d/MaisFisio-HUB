"use client";

import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, FileSpreadsheet, History, LoaderCircle, LogIn, Search } from "lucide-react";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NamedDateField } from "@/components/ui/date-field";
import { Select } from "@/components/ui/select";
import { ACTION_LABELS, ENTITY_LABELS, accessLabel, auditChanges, auditOrigin, collectAuditIds, describeAuditRecord, entityLabel, type AccessRow, type AuditRow, type NameLookup } from "@/lib/audit";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type AuditFilters = { aba: "alteracoes" | "acessos"; de: string; ate: string; entidade: string; acao: string; usuario: string; origem: "usuarios" | "sistema" | "todos"; pagina: number };

const ACTION_TONE: Record<string, string> = {
  INSERT: "bg-emerald-50 text-emerald-700 border-emerald-200",
  UPDATE: "bg-amber-50 text-amber-800 border-amber-200",
  DELETE: "bg-red-50 text-red-700 border-red-200",
};
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" });
const fmtDate = (value: string) => dateTime.format(new Date(value));

export function AuditView({ filters, changes, access, total, pageSize, names, actors, unitName, activeUnitId, error, today }: { filters: AuditFilters; changes: AuditRow[]; access: AccessRow[]; total: number; pageSize: number; names: NameLookup; actors: { id: string; name: string }[]; unitName: string; activeUnitId: string | null; error: string | null; today: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (patch: Partial<AuditFilters>) => {
    const next = { ...filters, ...patch };
    const p = new URLSearchParams();
    p.set("aba", next.aba); p.set("de", next.de); p.set("ate", next.ate);
    if (next.aba === "alteracoes") {
      if (next.entidade) p.set("entidade", next.entidade);
      if (next.acao) p.set("acao", next.acao);
      if (next.usuario) p.set("usuario", next.usuario);
      p.set("origem", next.origem);
    }
    if (next.pagina > 1) p.set("pagina", String(next.pagina));
    return `/auditoria?${p}`;
  };
  const first = total ? (filters.pagina - 1) * pageSize + 1 : 0;
  const last = Math.min(total, filters.pagina * pageSize);

  return <div className="grid grid-cols-1 gap-6">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="page-title">Auditoria</h1><p className="page-description">{unitName} · quem fez o quê, quando e o que mudou. Registros mantidos por 12 meses.</p></div>
      <ExportButton filters={filters} names={names} activeUnitId={activeUnitId} unitName={unitName} disabled={!total} />
    </header>

    <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Tipo de registro">
      <Link href={href({ aba: "alteracoes", pagina: 1 })} className={buttonVariants({ variant: filters.aba === "alteracoes" ? "default" : "outline" })}><History className="size-4" />Alterações de dados</Link>
      <Link href={href({ aba: "acessos", pagina: 1 })} className={buttonVariants({ variant: filters.aba === "acessos" ? "default" : "outline" })}><LogIn className="size-4" />Acessos ao sistema</Link>
    </nav>

    <Card><CardContent className="pt-5 md:pt-6"><form className="form-grid items-end">
      <input type="hidden" name="aba" value={filters.aba} />
      <div className="field col-span-2"><label className="text-xs font-semibold text-muted-foreground">De</label><NamedDateField name="de" defaultIso={filters.de} maxIso={today} /></div>
      <div className="field col-span-2"><label className="text-xs font-semibold text-muted-foreground">Até</label><NamedDateField name="ate" defaultIso={filters.ate} maxIso={today} /></div>
      {filters.aba === "alteracoes" && <>
        <div className="field col-span-2"><label className="text-xs font-semibold text-muted-foreground">O que foi alterado</label><Select name="entidade" defaultValue={filters.entidade}><option value="">Tudo</option>{Object.entries(ENTITY_LABELS).sort((a, b) => a[1].localeCompare(b[1])).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
        <div className="field col-span-2"><label className="text-xs font-semibold text-muted-foreground">Ação</label><Select name="acao" defaultValue={filters.acao}><option value="">Todas</option><option value="INSERT">Criação</option><option value="UPDATE">Alteração</option><option value="DELETE">Exclusão</option></Select></div>
        <div className="field col-span-2"><label className="text-xs font-semibold text-muted-foreground">Responsável</label><Select name="usuario" defaultValue={filters.usuario}><option value="">Todos</option>{actors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></div>
        <div className="field col-span-2"><label className="text-xs font-semibold text-muted-foreground">Origem</label><Select name="origem" defaultValue={filters.origem}><option value="usuarios">Ações de usuários</option><option value="sistema">Importações do sistema</option><option value="todos">Tudo</option></Select></div>
      </>}
      <Button type="submit" className={filters.aba === "alteracoes" ? "col-span-12 md:col-span-2 md:col-start-11" : "col-span-2"}><Search className="size-4" />Filtrar</Button>
    </form></CardContent></Card>

    {error && <Card className="border-red-200 bg-red-50"><CardContent className="pt-5 text-sm text-red-700">Não foi possível carregar a auditoria: {error}</CardContent></Card>}

    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div><CardTitle>{filters.aba === "alteracoes" ? "Trilha de alterações" : "Acessos ao sistema"}</CardTitle><CardDescription>{total ? `${first.toLocaleString("pt-BR")}–${last.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} registros` : "Nenhum registro no período com esses filtros."}</CardDescription></div>
        {pages > 1 && <Pager page={filters.pagina} pages={pages} href={(pagina) => href({ pagina })} />}
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        {filters.aba === "alteracoes" ? <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-y bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="w-10 px-3 py-3" /><th className="px-3 py-3">Data e hora</th><th className="px-3 py-3">Ação</th><th className="px-3 py-3">O que</th><th className="px-3 py-3">Registro</th><th className="px-3 py-3">Responsável</th></tr></thead>
          <tbody className="divide-y">{changes.map((row) => {
            const isOpen = open === row.id;
            const diff = isOpen ? auditChanges(row, names) : [];
            return <Fragment key={row.id}>
              <tr className={cn("cursor-pointer hover:bg-muted/40", isOpen && "bg-muted/30")} onClick={() => setOpen(isOpen ? null : row.id)}>
                <td className="px-3 py-3"><button type="button" aria-expanded={isOpen} aria-label="Ver detalhes" className="grid size-7 place-items-center rounded-lg hover:bg-muted"><ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} /></button></td>
                <td className="whitespace-nowrap px-3 py-3 tabular-nums">{fmtDate(row.changed_at)}</td>
                <td className="px-3 py-3"><Badge className={cn("border", ACTION_TONE[row.action])}>{ACTION_LABELS[row.action]}</Badge></td>
                <td className="px-3 py-3 font-medium">{entityLabel(row.table_name)}</td>
                <td className="max-w-[340px] truncate px-3 py-3 text-muted-foreground" title={describeAuditRecord(row, names)}>{describeAuditRecord(row, names)}</td>
                <td className="px-3 py-3">{row.changed_by ? row.changed_by_name ?? "Usuário removido" : <span className="text-muted-foreground">Sistema (importação)</span>}</td>
              </tr>
              {isOpen && <tr className="bg-muted/20"><td /><td colSpan={5} className="px-3 pb-4 pt-1">
                {diff.length ? <table className="w-full max-w-3xl overflow-hidden rounded-xl border bg-background text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-2 text-left">Campo</th><th className="px-3 py-2 text-left">Antes</th><th className="px-3 py-2 text-left">Depois</th></tr></thead>
                  <tbody className="divide-y">{diff.map((c) => <tr key={c.field}><td className="px-3 py-2 font-medium">{c.label}</td><td className={cn("px-3 py-2", row.action !== "INSERT" && "text-red-700 line-through decoration-red-300")}>{c.before}</td><td className={cn("px-3 py-2", row.action !== "DELETE" && "text-emerald-800")}>{c.after}</td></tr>)}</tbody>
                </table> : <p className="text-sm text-muted-foreground">Sem diferença em campos relevantes.</p>}
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">Registro {row.record_id ?? "—"} · log #{row.id}</p>
              </td></tr>}
            </Fragment>;
          })}</tbody>
        </table> : <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-y bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3">Data e hora</th><th className="px-3 py-3">Evento</th><th className="px-3 py-3">Usuário</th><th className="px-3 py-3">E-mail</th><th className="px-5 py-3">IP</th></tr></thead>
          <tbody className="divide-y">{access.map((row) => <tr key={row.id}><td className="whitespace-nowrap px-5 py-3 tabular-nums">{fmtDate(row.created_at)}</td><td className="px-3 py-3"><Badge className={cn("border", row.action === "login" ? ACTION_TONE.INSERT : row.action === "logout" ? "bg-slate-50 text-slate-700 border-slate-200" : ACTION_TONE.UPDATE)}>{accessLabel(row.action)}</Badge></td><td className="px-3 py-3 font-medium">{row.user_name ?? "—"}</td><td className="px-3 py-3 text-muted-foreground">{row.email ?? "—"}</td><td className="px-5 py-3 font-mono text-xs">{row.ip_address ?? "—"}</td></tr>)}</tbody>
        </table>}
      </CardContent>
      {pages > 1 && <CardContent className="flex justify-end border-t pt-4"><Pager page={filters.pagina} pages={pages} href={(pagina) => href({ pagina })} /></CardContent>}
    </Card>
  </div>;
}

function Pager({ page, pages, href }: { page: number; pages: number; href: (page: number) => string }) {
  return <div className="flex items-center gap-2 text-sm">
    {page > 1 ? <Link href={href(page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}><ChevronLeft className="size-4" />Anterior</Link> : <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none opacity-40")}><ChevronLeft className="size-4" />Anterior</span>}
    <span className="tabular-nums text-muted-foreground">Página {page} de {pages}</span>
    {page < pages ? <Link href={href(page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>Próxima<ChevronRight className="size-4" /></Link> : <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none opacity-40")}>Próxima<ChevronRight className="size-4" /></span>}
  </div>;
}

const EXPORT_LIMIT = 5000;

function ExportButton({ filters, names, activeUnitId, unitName, disabled }: { filters: AuditFilters; names: NameLookup; activeUnitId: string | null; unitName: string; disabled: boolean }) {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const supabase = createClient();
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const br = (d: string) => d.split("-").reverse().join("/");
      const header = [[`Auditoria — ${unitName}`], [`Período: ${br(filters.de)} a ${br(filters.ate)}`], []];
      let count = 0;
      if (filters.aba === "alteracoes") {
        const { data, error } = await supabase.rpc("audit_log_search", {
          p_unit: activeUnitId, p_start: filters.de, p_end: filters.ate,
          p_tables: filters.entidade ? [filters.entidade] : null, p_actions: filters.acao ? [filters.acao] : null,
          p_actor: filters.usuario || null, p_origin: filters.origem, p_limit: EXPORT_LIMIT, p_offset: 0,
        });
        if (error) throw error;
        const rows = (data ?? []) as AuditRow[];
        count = rows.length;
        const lookup = { ...names };
        const patientIds = collectAuditIds(rows, ["patient_id"]).filter((id) => !lookup[id]);
        for (let i = 0; i < patientIds.length; i += 200) {
          const { data: pts } = await supabase.from("patients").select("id,record_number,initials").in("id", patientIds.slice(i, i + 200));
          for (const pt of pts ?? []) lookup[pt.id] = `${pt.initials ?? ""} · pront. ${pt.record_number ?? "—"}`.trim();
        }
        const ws = XLSX.utils.aoa_to_sheet([...header,
          ["Data e hora", "Ação", "O que", "Registro", "Responsável", "Alterações (campo: antes → depois)", "Id do registro", "Log"],
          ...rows.map((r) => [fmtDate(r.changed_at), ACTION_LABELS[r.action], entityLabel(r.table_name), describeAuditRecord(r, lookup), auditOrigin(r),
            auditChanges(r, lookup).map((c) => r.action === "UPDATE" ? `${c.label}: ${c.before} → ${c.after}` : `${c.label}: ${r.action === "INSERT" ? c.after : c.before}`).join("; "),
            r.record_id ?? "", r.id]),
        ]);
        ws["!cols"] = [20, 11, 28, 48, 26, 80, 38, 9].map((wch) => ({ wch }));
        ws["!autofilter"] = { ref: `A4:H${rows.length + 4}` };
        XLSX.utils.book_append_sheet(wb, ws, "Alterações");
      } else {
        const { data, error } = await supabase.rpc("audit_access_log", { p_unit: activeUnitId, p_start: filters.de, p_end: filters.ate, p_limit: EXPORT_LIMIT, p_offset: 0 });
        if (error) throw error;
        const rows = (data ?? []) as AccessRow[];
        count = rows.length;
        const ws = XLSX.utils.aoa_to_sheet([...header, ["Data e hora", "Evento", "Usuário", "E-mail", "IP"], ...rows.map((r) => [fmtDate(r.created_at), accessLabel(r.action), r.user_name ?? "", r.email ?? "", r.ip_address ?? ""])]);
        ws["!cols"] = [20, 28, 28, 32, 16].map((wch) => ({ wch }));
        ws["!autofilter"] = { ref: `A4:E${rows.length + 4}` };
        XLSX.utils.book_append_sheet(wb, ws, "Acessos");
      }
      XLSX.writeFile(wb, `maisfisio-auditoria-${filters.aba}-${filters.de}-a-${filters.ate}.xlsx`);
      if (count >= EXPORT_LIMIT) toast.warning(`Exportados os ${EXPORT_LIMIT.toLocaleString("pt-BR")} registros mais recentes. Reduza o período para ver o restante.`);
    } catch (e) {
      toast.error(`Não foi possível exportar: ${e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }
  return <Button variant="outline" onClick={run} disabled={busy || disabled}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}Exportar Excel</Button>;
}
