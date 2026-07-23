import type { PostgrestSingleResponse } from "@supabase/supabase-js";

// PostgREST corta silenciosamente em 1000 linhas por padrão. Em vez de um
// .limit() fixo que trunca sem avisar em períodos grandes, busca TODAS as
// páginas — o dashboard e os relatórios nunca mais perdem linhas por corte.
// hardCap é uma trava de sanidade (não deve ser atingida em uso real), não
// um limite operacional.
export async function fetchAllRows<T>(
  buildPage: (from: number, to: number) => PromiseLike<PostgrestSingleResponse<T[]>>,
  pageSize = 1000,
  hardCap = 300000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildPage(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize || all.length >= hardCap) break;
    from += pageSize;
  }
  return all;
}
