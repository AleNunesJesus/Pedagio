import { createClient } from "@/lib/supabase/server";
import type { SituacaoCreditoDebito } from "./situacao";

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
  // número da viagem
  busca?: string;
  situacao?: SituacaoCreditoDebito;
  pagina?: number;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

// mesma consulta para a lista e para as contagens por situação
function consulta(supabase: Supabase, filtros: FiltrosCreditoDebito, head = false) {
  let query = supabase.from("vw_credito_debito_por_viagem").select("*", { count: "exact", head });

  if (filtros.embarcadorId) query = query.eq("embarcador_id", filtros.embarcadorId);
  if (filtros.busca) query = query.ilike("viagem_numero", `%${filtros.busca}%`);
  if (filtros.situacao === "ambos") {
    query = query.gt("qtd_credito", 0).gt("qtd_debito", 0);
  } else if (filtros.situacao === "so_credito") {
    query = query.gt("qtd_credito", 0).eq("qtd_debito", 0);
  } else if (filtros.situacao === "so_debito") {
    query = query.eq("qtd_credito", 0).gt("qtd_debito", 0);
  }
  return query;
}

export async function listCreditoDebitoPorViagem(filtros: FiltrosCreditoDebito) {
  const supabase = await createClient();
  const pagina = filtros.pagina && filtros.pagina > 0 ? filtros.pagina : 1;
  const de = (pagina - 1) * POR_PAGINA;
  const ate = de + POR_PAGINA - 1;

  // cada contagem troca só a situação e mantém os demais filtros
  const contar = async (situacao: SituacaoCreditoDebito) => {
    const { count } = await consulta(supabase, { ...filtros, situacao }, true);
    return count ?? 0;
  };
  const [lista, ambos, so_credito, so_debito] = await Promise.all([
    consulta(supabase, filtros).order("diferenca_abs", { ascending: false }).range(de, ate),
    contar("ambos"),
    contar("so_credito"),
    contar("so_debito"),
  ]);
  const { data, count, error } = lista;

  return {
    erro: error?.message ?? null,
    rows: (data ?? []) as CreditoDebitoPorViagem[],
    total: count ?? 0,
    pagina,
    totalPaginas: Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA)),
    contagemPorSituacao: { ambos, so_credito, so_debito } as Record<SituacaoCreditoDebito, number>,
  };
}
