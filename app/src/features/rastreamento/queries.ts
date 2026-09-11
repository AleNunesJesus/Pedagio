import { createClient } from "@/lib/supabase/server";

const LIMITE_PONTOS = 2000;

export type FiltrosPosicoes = {
  veiculoId?: string;
  dataInicio?: string;
  dataFim?: string;
};

export async function listPosicoes(filtros: FiltrosPosicoes) {
  const supabase = await createClient();

  let query = supabase
    .from("vw_posicao_veiculo")
    .select("*")
    .order("data_hora", { ascending: true })
    .limit(LIMITE_PONTOS);

  if (filtros.veiculoId) query = query.eq("veiculo_id", filtros.veiculoId);
  if (filtros.dataInicio) query = query.gte("data_hora", filtros.dataInicio);
  if (filtros.dataFim) query = query.lte("data_hora", `${filtros.dataFim}T23:59:59`);

  const { data } = await query;
  return data ?? [];
}

export async function getPosicao(id: number) {
  const supabase = await createClient();
  const { data } = await supabase.from("vw_posicao_veiculo").select("*").eq("id", id).single();
  return data;
}
