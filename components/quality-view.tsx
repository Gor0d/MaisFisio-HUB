"use client";

import { useMemo, useState } from "react";
import { CalendarSearch, Check, CircleAlert, ClipboardCopy, Download, FileSpreadsheet, LoaderCircle, Pencil, Plus, Search, Sigma, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  buildPortalRows, describeFormula, formatForPortal, formatQualityValue, missingReason,
  occurrenceLabel, periodLabel, targetStatus, type QualityIndicator, type QualityResult,
} from "@/lib/quality";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/utils";

type UnitRow = { id: string; code: string; name: string };
type ServiceRow = { id: string; name: string };
type IndicatorRow = { id: string; name: string; service_id: string; context: string };
type SectorRow = { id: string; unit_id: string; name: string; context: string };

const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

type Props = {
  month: string;
  units: UnitRow[];
  activeUnitId: string | null;
  services: ServiceRow[];
  indicators: IndicatorRow[];
  sectors: SectorRow[];
  quality: QualityIndicator[];
  results: QualityResult[];
  previousResults: QualityResult[];
};

export function QualityView(props: Props) {
  const [tab, setTab] = useState<"calculo" | "cadastro">("calculo");
  const [editing, setEditing] = useState<QualityIndicator | null>(null);
  const tabs = [{ id: "calculo", label: "Cálculo mensal", icon: Sigma }, { id: "cadastro", label: "Cadastro de indicadores", icon: Pencil }] as const;

  return <div className="grid gap-6">
    <header>
      <h1 className="page-title">Qualidade (Interact)</h1>
      <p className="page-description">Cadastre a fórmula de cada indicador do portal e o HUB calcula o resultado do mês a partir dos lançamentos da equipe.</p>
    </header>
    <div className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map(({ id, label, icon: Icon }) => <Button key={id} variant={tab === id ? "default" : "outline"} onClick={() => setTab(id)}><Icon className="size-4" />{label}</Button>)}
    </div>
    {tab === "calculo"
      ? <Monthly {...props} goToRegister={() => setTab("cadastro")} />
      : <Register {...props} editing={editing} setEditing={setEditing} />}
  </div>;
}

/* ------------------------------ Cálculo mensal ------------------------------ */

function Monthly({ month, units, indicators, sectors, quality, results, previousResults, goToRegister }: Props & { goToRegister: () => void }) {
  const [competencia, setCompetencia] = useState(month);
  const years = Array.from({ length: new Date().getFullYear() - 2022 }, (_, i) => String(2023 + i));
  const unitName = useMemo(() => new Map(units.map((unit) => [unit.id, unit.name])), [units]);
  const resultById = useMemo(() => new Map(results.map((r) => [r.quality_indicator_id, r])), [results]);
  const previousById = useMemo(() => new Map(previousResults.map((r) => [r.quality_indicator_id, r])), [previousResults]);
  const indicatorNames = useMemo(() => new Map(indicators.map((x) => [x.id, x.name])), [indicators]);
  const sectorNames = useMemo(() => new Map(sectors.map((x) => [x.id, x.name])), [sectors]);
  const active = quality.filter((item) => item.active);

  const items = active.map((indicator) => ({ indicator, result: resultById.get(indicator.id), unitName: unitName.get(indicator.unit_id) ?? "" }));
  const calculated = items.filter((item) => item.result?.value != null).length;
  const achieved = items.filter((item) => targetStatus(item.result?.value ?? null, item.indicator) === true).length;
  const withTarget = items.filter((item) => targetStatus(item.result?.value ?? null, item.indicator) !== null).length;
  const fileName = `interact-${month}`;

  function exportCsv() {
    const rows = buildPortalRows(items, month);
    const headers = Object.keys(rows[0] ?? {});
    const csv = "﻿" + [headers, ...rows.map((row) => headers.map((h) => row[h as keyof typeof row]))]
      .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${fileName}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(buildPortalRows(items, month));
    sheet["!cols"] = [{ wch: 18 }, { wch: 60 }, { wch: 32 }, { wch: 24 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 40 }];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Indicadores Interact");
    XLSX.writeFile(book, `${fileName}.xlsx`, { compression: true });
  }

  async function copy(indicator: QualityIndicator, value: number | string | null) {
    try {
      await navigator.clipboard.writeText(formatForPortal(value, indicator.decimals));
      toast.success(`Resultado de "${indicator.name.slice(0, 40)}" copiado.`);
    } catch {
      toast.error("Não foi possível copiar. Selecione o valor manualmente.");
    }
  }

  return <div className="grid gap-6">
    <Card className="no-print">
      <CardContent className="flex flex-col gap-4 pt-5 md:flex-row md:items-end md:justify-between md:pt-6">
        <form method="get" className="flex flex-col items-end gap-3 sm:flex-row">
          <div className="field">
            <Label>Competência</Label>
            <div className="flex gap-2">
              <Select aria-label="Mês" value={competencia.slice(5, 7)} onChange={(e) => setCompetencia(`${competencia.slice(0, 4)}-${e.target.value}`)}>{monthNames.map((name, i) => <option key={name} value={String(i + 1).padStart(2, "0")}>{name}</option>)}</Select>
              <Select aria-label="Ano" value={competencia.slice(0, 4)} onChange={(e) => setCompetencia(`${e.target.value}${competencia.slice(4)}`)}>{years.map((y) => <option key={y}>{y}</option>)}</Select>
            </div>
            <input type="hidden" name="mes" value={competencia} />
          </div>
          <Button type="submit"><CalendarSearch className="size-4" />Calcular</Button>
        </form>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={!items.length}><Download className="size-4" />CSV</Button>
          <Button variant="outline" onClick={exportExcel} disabled={!items.length}><FileSpreadsheet className="size-4" />Excel</Button>
        </div>
      </CardContent>
    </Card>

    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Summary label="Período" value={periodLabel(month)} small />
      <Summary label="Ocorrência no portal" value={occurrenceLabel(month)} small />
      <Summary label="Indicadores calculados" value={`${calculated} de ${items.length}`} />
      <Summary label="Metas atingidas" value={withTarget ? `${achieved} de ${withTarget}` : "—"} />
    </div>

    {items.length === 0
      ? <Card><CardContent className="grid place-items-center gap-3 py-14 text-center"><Sigma className="size-8 text-muted-foreground" /><p className="font-semibold">Nenhum indicador de qualidade cadastrado.</p><p className="max-w-md text-sm text-muted-foreground">Cadastre os indicadores do portal informando de quais lançamentos do HUB sai o numerador e o denominador.</p><Button onClick={goToRegister}><Plus className="size-4" />Cadastrar o primeiro indicador</Button></CardContent></Card>
      : <Card>
        <CardHeader><CardTitle>Resultados de {occurrenceLabel(month)}</CardTitle><CardDescription>Copie o resultado de cada indicador ou exporte a planilha completa para lançar no portal.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-y bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="px-6 py-3">Indicador</th><th className="px-3 py-3 text-right">Numerador</th><th className="px-3 py-3 text-right">Denominador</th><th className="px-3 py-3 text-right">Resultado</th><th className="px-3 py-3 text-right">Mês anterior</th><th className="px-6 py-3">Meta</th></tr></thead>
            <tbody className="divide-y">
              {items.map(({ indicator, result }) => {
                const reason = missingReason(indicator, result);
                const status = targetStatus(result?.value ?? null, indicator);
                const previous = previousById.get(indicator.id)?.value ?? null;
                return <tr key={indicator.id} className="align-top">
                  <td className="px-6 py-4">
                    <p className="font-semibold">{indicator.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{indicator.interact_code ? `${indicator.interact_code} · ` : ""}{units.length > 1 ? `${units.find((u) => u.id === indicator.unit_id)?.name ?? ""}` : ""}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{describeFormula(indicator, indicatorNames, sectorNames)}</p>
                  </td>
                  <td className="px-3 py-4 text-right tabular-nums">{result?.numerator != null ? formatQualityValue(result.numerator, 0, "un.") : "—"}</td>
                  <td className="px-3 py-4 text-right tabular-nums">{indicator.denominator_ids.length === 0 ? <span className="text-muted-foreground">n/a</span> : result?.denominator != null ? formatQualityValue(result.denominator, 0, "un.") : "—"}</td>
                  <td className="px-3 py-4 text-right">
                    {reason
                      ? <span className="inline-flex items-center gap-1 text-xs text-amber-700"><CircleAlert className="size-3.5" />{reason}</span>
                      : <span className="inline-flex items-center gap-2"><strong className="whitespace-nowrap text-base tabular-nums">{formatQualityValue(result?.value ?? null, indicator.decimals, indicator.result_unit)}</strong><Button size="icon" variant="ghost" className="size-8" aria-label="Copiar resultado" title="Copiar resultado" onClick={() => copy(indicator, result?.value ?? null)}><ClipboardCopy className="size-4" /></Button></span>}
                  </td>
                  <td className="px-3 py-4 text-right tabular-nums text-muted-foreground">{formatQualityValue(previous, indicator.decimals, indicator.result_unit)}</td>
                  <td className="px-6 py-4">{indicator.target_value == null ? <span className="text-muted-foreground">—</span> : <div className="grid gap-1"><span className="text-xs text-muted-foreground">{indicator.target_comparison === "maximo" ? "máx." : "mín."} {formatQualityValue(indicator.target_value, indicator.decimals, indicator.result_unit)}</span>{status !== null && <Badge className={status ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>{status ? "Atingida" : "Não atingida"}</Badge>}</div>}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>}
  </div>;
}

function Summary({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return <Card><CardContent className="pt-5"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className={small ? "mt-1 text-base font-semibold" : "mt-1 text-2xl font-bold"}>{value}</p></CardContent></Card>;
}

/* ---------------------------------- Cadastro --------------------------------- */

type Draft = {
  name: string; interact_code: string; unit_id: string; service_id: string; kind: "soma" | "taxa";
  numerator_ids: string[]; denominator_ids: string[]; sector_ids: string[];
  multiplier: string; decimals: string; target_comparison: "" | "minimo" | "maximo"; target_value: string; notes: string;
};

const unitLabel: Record<string, string> = { "100": "%", "1000": "por 1.000", "1": "razão" };

function emptyDraft(unitId: string): Draft {
  return { name: "", interact_code: "", unit_id: unitId, service_id: "", kind: "taxa", numerator_ids: [], denominator_ids: [], sector_ids: [], multiplier: "100", decimals: "2", target_comparison: "", target_value: "", notes: "" };
}

function draftFrom(item: QualityIndicator): Draft {
  return {
    name: item.name, interact_code: item.interact_code ?? "", unit_id: item.unit_id, service_id: item.service_id ?? "",
    kind: item.denominator_ids.length ? "taxa" : "soma",
    numerator_ids: item.numerator_ids, denominator_ids: item.denominator_ids, sector_ids: item.sector_ids,
    multiplier: String(Number(item.multiplier)), decimals: String(item.decimals),
    target_comparison: item.target_comparison ?? "", target_value: item.target_value == null ? "" : String(item.target_value), notes: item.notes ?? "",
  };
}

function Register({ units, activeUnitId, services, indicators, sectors, quality, editing, setEditing }: Props & { editing: QualityIndicator | null; setEditing: (item: QualityIndicator | null) => void }) {
  const defaultUnit = activeUnitId ?? units[0]?.id ?? "";
  const [draft, setDraft] = useState<Draft>(editing ? draftFrom(editing) : emptyDraft(defaultUnit));
  const [pending, setPending] = useState(false);
  const unitSectors = sectors.filter((sector) => sector.unit_id === draft.unit_id);
  const indicatorNames = new Map(indicators.map((x) => [x.id, x.name]));
  const sectorNames = new Map(sectors.map((x) => [x.id, x.name]));
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  function startEditing(item: QualityIndicator | null) {
    setEditing(item);
    setDraft(item ? draftFrom(item) : emptyDraft(defaultUnit));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function changeKind(kind: Draft["kind"]) {
    setDraft((current) => ({ ...current, kind, decimals: kind === "soma" ? "0" : current.decimals === "0" ? "2" : current.decimals, denominator_ids: kind === "soma" ? [] : current.denominator_ids }));
  }

  async function save() {
    if (draft.name.trim().length < 3) return void toast.error("Informe o nome do indicador, como aparece no portal.");
    if (!draft.numerator_ids.length) return void toast.error("Escolha ao menos um indicador para o numerador.");
    if (draft.kind === "taxa" && !draft.denominator_ids.length) return void toast.error("Escolha ao menos um indicador para o denominador ou use \"Quantidade\".");
    if (draft.target_comparison && draft.target_value === "") return void toast.error("Informe o valor da meta.");

    const isRate = draft.kind === "taxa";
    const payload = {
      service_id: draft.service_id || null,
      name: draft.name.trim(),
      interact_code: draft.interact_code.trim() || null,
      numerator_ids: draft.numerator_ids,
      denominator_ids: isRate ? draft.denominator_ids : [],
      sector_ids: draft.sector_ids,
      multiplier: isRate ? Number(draft.multiplier) : 1,
      result_unit: isRate ? unitLabel[draft.multiplier] ?? "%" : "un.",
      decimals: Number(draft.decimals),
      target_comparison: draft.target_comparison || null,
      target_value: draft.target_comparison ? Number(draft.target_value.replace(",", ".")) : null,
      notes: draft.notes.trim() || null,
    };

    setPending(true);
    const supabase = createClient();
    const { error } = editing
      ? await supabase.from("quality_indicators").update(payload).eq("id", editing.id)
      : await supabase.from("quality_indicators").insert({ ...payload, unit_id: draft.unit_id });
    setPending(false);

    if (error) {
      toast.error(error.message.includes("quality_indicators_unit_name_key") ? "Já existe um indicador com este nome nesta unidade." : friendlyError(error));
      return;
    }
    toast.success(editing ? "Indicador atualizado." : "Indicador cadastrado.");
    location.reload();
  }

  async function toggle(item: QualityIndicator) {
    const { error } = await createClient().from("quality_indicators").update({ active: !item.active }).eq("id", item.id);
    if (error) toast.error(friendlyError(error)); else location.reload();
  }

  return <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>{editing ? "Editar indicador" : "Novo indicador de qualidade"}</CardTitle>
        <CardDescription>Use o mesmo nome do portal. O resultado é calculado sozinho a partir do que a equipe lança em &ldquo;Lançar produção&rdquo;.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="field md:col-span-2"><Label>Nome do indicador (como no portal)</Label><Input value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: PSI - Taxa de Elegibilidade Para Acompanhamento Psicológico" /></div>
          <div className="field"><Label>Código no Interact (opcional)</Label><Input value={draft.interact_code} onChange={(e) => set("interact_code", e.target.value)} placeholder="Ex.: PSI-02" /></div>
          <div className="field"><Label>Unidade</Label>{editing || units.length === 1
            ? <Select value={draft.unit_id} disabled><option value={draft.unit_id}>{units.find((u) => u.id === draft.unit_id)?.name}</option></Select>
            : <Select value={draft.unit_id} onChange={(e) => setDraft((c) => ({ ...c, unit_id: e.target.value, sector_ids: [] }))}>{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>}</div>
          <div className="field md:col-span-2"><Label>Serviço (para organizar)</Label><Select value={draft.service_id} onChange={(e) => set("service_id", e.target.value)}><option value="">Sem serviço específico</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
        </div>

        <div className="field"><Label>Tipo de resultado</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {([["taxa", "Taxa / índice", "numerador ÷ denominador"], ["soma", "Quantidade", "soma dos lançamentos no mês"]] as const).map(([value, title, hint]) =>
              <button key={value} type="button" onClick={() => changeKind(value)} className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${draft.kind === value ? "border-primary bg-primary/5" : "hover:bg-muted"}`}><span className="flex items-center gap-2 font-semibold">{draft.kind === value && <Check className="size-4 text-primary" />}{title}</span><span className="text-xs text-muted-foreground">{hint}</span></button>)}
          </div>
        </div>

        <IndicatorPicker label={draft.kind === "taxa" ? "Numerador" : "Indicadores somados"} hint="Valores lançados pela equipe que serão somados no mês." selected={draft.numerator_ids} onChange={(ids) => set("numerator_ids", ids)} indicators={indicators} services={services} />
        {draft.kind === "taxa" && <IndicatorPicker label="Denominador" hint="Base de comparação (ex.: admissões, pacientes avaliados)." selected={draft.denominator_ids} onChange={(ids) => set("denominator_ids", ids)} indicators={indicators} services={services} />}

        {draft.kind === "taxa" && <div className="grid gap-4 sm:grid-cols-2">
          <div className="field"><Label>Multiplicar por</Label><Select value={draft.multiplier} onChange={(e) => set("multiplier", e.target.value)}><option value="100">100 — percentual (%)</option><option value="1000">1.000 — por mil</option><option value="1">1 — razão simples</option></Select></div>
          <div className="field"><Label>Casas decimais</Label><Select value={draft.decimals} onChange={(e) => set("decimals", e.target.value)}>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</Select></div>
        </div>}

        <fieldset className="grid gap-2"><legend className="mb-1 text-sm font-medium">Setores considerados <span className="font-normal text-muted-foreground">— nenhum marcado = todos (marque só a UTI para um indicador “UTI”)</span></legend>
          <div className="flex flex-wrap gap-2">{unitSectors.map((sector) => { const on = draft.sector_ids.includes(sector.id); return <button key={sector.id} type="button" onClick={() => set("sector_ids", on ? draft.sector_ids.filter((id) => id !== sector.id) : [...draft.sector_ids, sector.id])} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{sector.name}</button>; })}{!unitSectors.length && <p className="text-xs text-muted-foreground">Esta unidade ainda não tem setores cadastrados.</p>}</div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="field"><Label>Meta (opcional)</Label><Select value={draft.target_comparison} onChange={(e) => set("target_comparison", e.target.value as Draft["target_comparison"])}><option value="">Sem meta</option><option value="minimo">Mínimo</option><option value="maximo">Máximo</option></Select></div>
          <div className="field"><Label>Valor da meta</Label><Input inputMode="decimal" value={draft.target_value} disabled={!draft.target_comparison} onChange={(e) => set("target_value", e.target.value)} placeholder="Ex.: 80" /></div>
        </div>
        <div className="field"><Label>Observações (ficha técnica, fonte, critérios)</Label><Textarea value={draft.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Cole aqui a definição do indicador no Interact para consulta da equipe." /></div>

        <div className="rounded-xl bg-muted/60 p-3 text-xs"><p className="font-semibold">Prévia da fórmula</p><p className="mt-1 text-muted-foreground">{draft.numerator_ids.length ? describeFormula({ numerator_ids: draft.numerator_ids, denominator_ids: draft.kind === "taxa" ? draft.denominator_ids : [], sector_ids: draft.sector_ids, multiplier: draft.kind === "taxa" ? draft.multiplier : 1, result_unit: "" }, indicatorNames, sectorNames) : "Escolha os indicadores do numerador."}</p></div>

        <div className="flex gap-2">
          <Button onClick={save} disabled={pending} className="flex-1">{pending ? <LoaderCircle className="size-4 animate-spin" /> : editing ? <Pencil className="size-4" /> : <Plus className="size-4" />}{pending ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar indicador"}</Button>
          {editing && <Button variant="outline" onClick={() => startEditing(null)}><X className="size-4" />Cancelar</Button>}
        </div>
      </CardContent>
    </Card>

    <Card className="h-fit">
      <CardHeader><CardTitle>Indicadores cadastrados</CardTitle><CardDescription>{quality.length} no escopo atual</CardDescription></CardHeader>
      <CardContent className="divide-y p-0">
        {quality.map((item) => <div key={item.id} className="px-5 py-4 md:px-6">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.interact_code ? `${item.interact_code} · ` : ""}{units.find((u) => u.id === item.unit_id)?.name}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{describeFormula(item, indicatorNames, sectorNames)}</p></div>
            <div className="flex shrink-0 flex-col items-end gap-2"><Badge className={item.active ? "" : "bg-muted text-muted-foreground"}>{item.active ? "Ativo" : "Inativo"}</Badge><div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => startEditing(item)}>Editar</Button><Button size="sm" variant="ghost" onClick={() => toggle(item)}>{item.active ? "Desativar" : "Ativar"}</Button></div></div>
          </div>
        </div>)}
        {!quality.length && <p className="px-6 py-10 text-center text-sm text-muted-foreground">Nenhum indicador cadastrado ainda.</p>}
      </CardContent>
    </Card>
  </div>;
}

function IndicatorPicker({ label, hint, selected, onChange, indicators, services }: { label: string; hint: string; selected: string[]; onChange: (ids: string[]) => void; indicators: IndicatorRow[]; services: ServiceRow[] }) {
  const [search, setSearch] = useState("");
  const [serviceId, setServiceId] = useState("");
  const names = new Map(indicators.map((i) => [i.id, i.name]));
  const visible = indicators.filter((i) => (!serviceId || i.service_id === serviceId) && i.name.toLowerCase().includes(search.trim().toLowerCase()));
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return <div className="grid gap-2">
    <div><Label>{label}</Label><p className="text-xs text-muted-foreground">{hint}</p></div>
    {selected.length > 0 && <div className="flex flex-wrap gap-1.5">{selected.map((id) => <button key={id} type="button" onClick={() => toggle(id)} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20">{names.get(id) ?? "indicador removido"}<X className="size-3" /></button>)}</div>}
    <div className="grid gap-2 sm:grid-cols-[1fr_200px]">
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar indicador..." aria-label={`Buscar ${label}`} /></div>
      <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)} aria-label="Filtrar por serviço"><option value="">Todos os serviços</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
    </div>
    <div className="max-h-56 divide-y overflow-y-auto rounded-xl border">
      {visible.map((i) => <label key={i.id} className="flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm hover:bg-muted/50"><input type="checkbox" checked={selected.includes(i.id)} onChange={() => toggle(i.id)} className="mt-0.5 size-4 accent-primary" /><span className="min-w-0"><span className="block">{i.name}</span></span></label>)}
      {!visible.length && <p className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhum indicador de contagem encontrado.</p>}
    </div>
  </div>;
}
