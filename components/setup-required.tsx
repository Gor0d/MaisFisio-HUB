import { AlertTriangle } from "lucide-react";
import { Alert } from "@/components/ui/alert";

export function SetupRequired() {
  return (
    <Alert className="flex items-start gap-3 border-amber-200 bg-amber-50 text-amber-950">
      <AlertTriangle className="mt-0.5 size-5 shrink-0" />
      <div>
        <p className="font-semibold">Supabase ainda não configurado</p>
        <p className="mt-1 text-amber-900/80">Copie <code>.env.example</code> para <code>.env.local</code>, preencha as chaves e aplique as migrações e o seed.</p>
      </div>
    </Alert>
  );
}
