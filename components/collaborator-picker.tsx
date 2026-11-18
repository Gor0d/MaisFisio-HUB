"use client";

import { Check, Search, UserPlus, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Option = { id: string; canonical_name: string };

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Seleção de um ou mais colaboradores do turno (substitui o <select> único,
// que obrigava a planilha a ter nomes de grupo como "AMANDA/FELIX").
export function CollaboratorPicker({ options, value, onChange, invalid }: { options: Option[]; value: string[]; onChange: (ids: string[]) => void; invalid?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const byId = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);
  const selected = value.filter((id) => byId.has(id));
  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    return term ? options.filter((option) => normalize(option.canonical_name).includes(term)) : options;
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div ref={rootRef} className="relative grid gap-2" onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
      <div className={cn("flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 focus-within:ring-2 focus-within:ring-primary/30", invalid && "border-red-400")}>
        {selected.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 rounded-full bg-secondary py-1 pl-2.5 pr-1 text-xs font-medium text-secondary-foreground">
            {byId.get(id)?.canonical_name}
            <button type="button" onClick={() => toggle(id)} aria-label={`Remover ${byId.get(id)?.canonical_name}`} className="grid size-5 place-items-center rounded-full hover:bg-black/10"><X className="size-3" /></button>
          </span>
        ))}
        <div className="flex min-w-[9rem] flex-1 items-center gap-1.5 px-1">
          {selected.length ? <UserPlus className="size-4 shrink-0 text-muted-foreground" /> : <Search className="size-4 shrink-0 text-muted-foreground" />}
          <input
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-label="Buscar colaborador"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={selected.length ? "Adicionar outro" : "Buscar e selecionar"}
            className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      {open && (
        <ul id={listId} role="listbox" aria-multiselectable className="absolute top-full z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-card p-1 shadow-lg">
          {filtered.map((option) => {
            const checked = selected.includes(option.id);
            return (
              <li key={option.id} role="option" aria-selected={checked}>
                <button type="button" onClick={() => { toggle(option.id); setQuery(""); }} className={cn("flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-sm hover:bg-muted", checked && "font-medium")}>
                  <span className={cn("grid size-4 shrink-0 place-items-center rounded border", checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>{checked && <Check className="size-3" />}</span>
                  {option.canonical_name}
                </button>
              </li>
            );
          })}
          {!filtered.length && <li className="px-2.5 py-2 text-sm text-muted-foreground">Nenhum colaborador encontrado.</li>}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{selected.length > 1 ? `${selected.length} profissionais neste lançamento.` : "Selecione todos que trabalharam neste turno e setor."}</p>
    </div>
  );
}
