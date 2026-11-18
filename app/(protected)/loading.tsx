import { Loader2 } from "lucide-react";

// Retorno imediato ao trocar de tela pelo menu: sem isto, o Next mantém a tela
// anterior parada até o servidor responder e o clique parece não ter funcionado.
export default function Loading() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="size-5 animate-spin text-primary" />
        <span className="text-sm">Carregando…</span>
      </div>
      <div className="h-9 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
