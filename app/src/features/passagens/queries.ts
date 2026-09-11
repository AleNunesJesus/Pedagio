import { createClient } from "@/lib/supabase/server";

const POR_PAGINA = 50;

export type FiltrosPassagens = {
  status?: string;
  pracaId?: string;
  veiculoId?: string;
  tipoUso?: string;
  dataInicio?: string;
  dataFim?: string;
  pagina?: number;
};

export async function listPassagens(filtros: FiltrosPassagens) {
  const supabase = await createClient();
  const pagina = filtros.pagina && filtros.pagina > 0 ? filtros.pagina : 1;
  const de = (pagina - 1) * POR_PAGINA;
  const ate = de + POR_PAGINA - 1;

  let query = supabase
    .from("vw_passagens_detalhado")
    .select("*", { count: "exact" })
    .order("data_hora", { ascending: false })
    .range(de, ate);

  if (filtros.status) query = query.eq("status_validacao", filtros.status);
  if (filtros.pracaId) query = query.eq("praca_id", filtros.pracaId);
  if (filtros.veiculoId) query = query.eq("veiculo_id", filtros.veiculoId);
  if (filtros.tipoUso) query = query.eq("tipo_uso", filtros.tipoUso);
  if (filtros.dataInicio) query = query.gte("data_hora", filtros.dataInicio);
  if (filtros.dataFim) query = query.lte("data_hora", `${filtros.dataFim}T23:59:59`);

  const { data, count } = await query;

  return {
    rows: data ?? [],
    total: count ?? 0,
    pagina,
    totalPaginas: Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA)),
  };
}

export async function getPassagemDetalhe(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vw_passagens_detalhado")
    .select("*")
    .eq("passagem_id", id)
    .single();
  return data;
}
