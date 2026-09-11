import { createClient } from "@/lib/supabase/server";

export async function listLotesImportacao() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lote_importacao")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

export async function getResumoLote(loteId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("passagem_pedagio")
    .select("status_validacao")
    .eq("lote_importacao_id", loteId);

  const contagem = new Map<string, number>();
  for (const row of data ?? []) {
    contagem.set(row.status_validacao, (contagem.get(row.status_validacao) ?? 0) + 1);
  }
  return Array.from(contagem.entries()).map(([status_validacao, qtd]) => ({
    status_validacao,
    qtd,
  }));
}
