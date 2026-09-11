import { createClient } from "@/lib/supabase/server";

const POR_PAGINA = 50;

export type FiltrosViagensTransporte = {
  veiculoId?: string;
  tipoViagem?: string;
  embarcadorId?: string;
  dataInicio?: string;
  dataFim?: string;
  pagina?: number;
};

export async function listViagensTransporte(filtros: FiltrosViagensTransporte) {
  const supabase = await createClient();
  const pagina = filtros.pagina && filtros.pagina > 0 ? filtros.pagina : 1;
  const de = (pagina - 1) * POR_PAGINA;
  const ate = de + POR_PAGINA - 1;

  let query = supabase
    .from("vw_viagem_transporte_detalhado")
    .select("*", { count: "exact" })
    .order("data_hora_saida", { ascending: false })
    .range(de, ate);

  if (filtros.veiculoId) query = query.eq("veiculo_id", filtros.veiculoId);
  if (filtros.tipoViagem) query = query.eq("tipo_viagem", filtros.tipoViagem);
  if (filtros.embarcadorId) query = query.eq("embarcador_id", filtros.embarcadorId);
  if (filtros.dataInicio) query = query.gte("data_hora_saida", filtros.dataInicio);
  if (filtros.dataFim) query = query.lte("data_hora_saida", `${filtros.dataFim}T23:59:59`);

  const { data, count } = await query;

  return {
    rows: data ?? [],
    total: count ?? 0,
    pagina,
    totalPaginas: Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA)),
  };
}
