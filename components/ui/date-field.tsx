"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

// Campo de data sempre em dd/mm/aaaa, independente do idioma do navegador
// (o <input type="date"> nativo segue o locale do navegador, que nem sempre
// é pt-BR nos computadores dos hospitais). Emite/aceita ISO (aaaa-mm-dd).

function isoToBr(iso?: string) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function brToIso(br: string) {
  const match = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return "";
  const [, d, m, y] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  const valid = date.getUTCFullYear() === Number(y) && date.getUTCMonth() === Number(m) - 1 && date.getUTCDate() === Number(d);
  return valid ? `${y}-${m}-${d}` : "";
}

function mask(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function DateField({ iso, onIso, maxIso, id, className }: { iso?: string; onIso: (iso: string) => void; maxIso?: string; id?: string; className?: string }) {
  const [text, setText] = useState(() => isoToBr(iso));
  const [invalid, setInvalid] = useState(false);
  function handle(raw: string) {
    const masked = mask(raw);
    setText(masked);
    if (masked.length < 10) { setInvalid(false); onIso(""); return; }
    const parsed = brToIso(masked);
    const tooLate = Boolean(parsed && maxIso && parsed > maxIso);
    setInvalid(!parsed || tooLate);
    onIso(!parsed || tooLate ? "" : parsed);
  }
  return <Input id={id} value={text} onChange={(e) => handle(e.target.value)} placeholder="dd/mm/aaaa" inputMode="numeric" autoComplete="off" aria-invalid={invalid} className={`${className ?? ""} ${invalid ? "border-red-400 focus-visible:ring-red-300" : ""}`} />;
}

// Variante para formulários GET (filtros): mantém o valor ISO num input oculto
// com o nome do parâmetro, sem depender de estado externo.
export function NamedDateField({ name, defaultIso, maxIso }: { name: string; defaultIso?: string; maxIso?: string }) {
  const [iso, setIso] = useState(defaultIso ?? "");
  return <>
    <DateField iso={defaultIso} onIso={setIso} maxIso={maxIso} />
    <input type="hidden" name={name} value={iso} />
  </>;
}
