import { createClient } from "@/lib/supabase/server";

const POR_PAGINA = 50;

export type CreditoDebitoPorViagem = {
  viagem_id: string | null;
  viagem_numero: string | null;
  embarcador_id: string | null;
  embarcador_nome: string | null;
  qtd_credito: number | null;
  qtd_debito: number | null;
  valor_credito: number | null;
  valor_debito: number | null;
  diferenca: number | null;
  diferenca_abs: number | null;
};

export type FiltrosCreditoDebito = {
  embarcadorId?: string;
  viagem?: string;
  pagina?: number;
};

export async function listCreditoDebitoPorViagem(filtros: FiltrosCreditoDebito) {
  const supabase = await createClient();
  const pagina = filtros.pagina && filtros.pagina > 0 ? filtros.pagina : 1;
  const de = (pagina - 1) * POR_PAGINA;
  const ate = de + POR_PAGINA - 1;

  let query = supabase
    .from("vw_credito_debito_por_viagem")
    .select("*", { count: "exact" })
    .order("diferenca_abs", { ascending: false })
    .range(de, ate);

  if (filtros.embarcadorId) query = query.eq("embarcador_id", filtros.embarcadorId);
  if (filtros.viagem) query = query.ilike("viagem_numero", `%${filtros.viagem}%`);

  const { data, count } = await query;

  return {
    rows: (data ?? []) as CreditoDebitoPorViagem[],
    total: count ?? 0,
    pagina,
    totalPaginas: Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA)),
  };
}
