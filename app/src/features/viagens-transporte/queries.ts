import { createClient } from "@/lib/supabase/server";

const POR_PAGINA = 50;

export type DivergenciaFiltro = "mais" | "menos" | "zero";

export type FiltrosViagensTransporte = {
  // número do transporte ou placa
  busca?: string;
  veiculoId?: string;
  tipoViagem?: string;
  embarcadorId?: string;
  divergencia?: string;
  dataInicio?: string;
  dataFim?: string;
  pagina?: number;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

// mesma consulta para a lista e para as contagens dos filtros
function consulta(supabase: Supabase, f: FiltrosViagensTransporte, head = false) {
  let q = supabase.from("vw_viagem_transporte_detalhado").select("*", { count: "exact", head });

  if (f.busca) {
    // vírgula e parênteses quebram a sintaxe do or() do PostgREST
    const termo = f.busca.replace(/[,()]/g, " ").trim();
    if (termo) q = q.or(`numero_transporte.ilike.%${termo}%,placa_informada.ilike.%${termo}%`);
  }
  if (f.veiculoId) q = q.eq("veiculo_id", f.veiculoId);
  if (f.tipoViagem) q = q.eq("tipo_viagem", f.tipoViagem);
  if (f.embarcadorId) q = q.eq("embarcador_id", f.embarcadorId);
  if (f.divergencia === "mais") q = q.gt("divergencia_valor", 0);
  if (f.divergencia === "menos") q = q.lt("divergencia_valor", 0);
  if (f.divergencia === "zero") q = q.eq("divergencia_valor", 0);
  if (f.dataInicio) q = q.gte("data_hora_saida", f.dataInicio);
  if (f.dataFim) q = q.lte("data_hora_saida", `${f.dataFim}T23:59:59`);
  return q;
}

export async function listViagensTransporte(filtros: FiltrosViagensTransporte) {
  const supabase = await createClient();
  const pagina = filtros.pagina && filtros.pagina > 0 ? filtros.pagina : 1;
  const de = (pagina - 1) * POR_PAGINA;
  const ate = de + POR_PAGINA - 1;

  // cada contagem troca só o próprio filtro e mantém os demais
  const contar = async (troca: FiltrosViagensTransporte) => {
    const { count } = await consulta(supabase, { ...filtros, ...troca }, true);
    return count ?? 0;
  };

  const [lista, carregado, vazio, mais, menos, zero] = await Promise.all([
    consulta(supabase, filtros).order("data_hora_saida", { ascending: false }).range(de, ate),
    contar({ tipoViagem: "carregado" }),
    contar({ tipoViagem: "vazio" }),
    contar({ divergencia: "mais" }),
    contar({ divergencia: "menos" }),
    contar({ divergencia: "zero" }),
  ]);
  const { data, count, error } = lista;

  return {
    // sem isso um erro do banco (ex.: statement timeout) aparecia como "0 viagens"
    erro: error?.message ?? null,
    rows: data ?? [],
    total: count ?? 0,
    pagina,
    totalPaginas: Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA)),
    contagens: {
      tipo: { carregado, vazio },
      divergencia: { mais, menos, zero },
    },
  };
}

// Viagem selecionada + passagens que compõem o "valor pedágios" dela: mesmo
// critério da vw_viagem_transporte_detalhado (placa normalizada, tipo_uso
// 'passagem', data_hora entre saída e chegada)
export async function getViagemDetalhe(id: string) {
  const supabase = await createClient();
  const { data: viagem } = await supabase
    .from("vw_viagem_transporte_detalhado")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!viagem?.placa_informada || !viagem.data_hora_saida || !viagem.data_hora_chegada) {
    return viagem ? { viagem, passagens: [] } : null;
  }

  const { data: passagens } = await supabase
    .from("passagem_pedagio")
    .select(
      "id, data_hora, valor_cobrado, status_validacao, praca_informada, praca_pedagio(nome), validacao_passagem(dentro_poligono, valor_esperado)",
    )
    .eq("placa_norm", viagem.placa_informada.trim().toUpperCase())
    .eq("tipo_uso", "passagem")
    .gte("data_hora", viagem.data_hora_saida)
    .lte("data_hora", viagem.data_hora_chegada)
    .order("data_hora");

  return { viagem, passagens: passagens ?? [] };
}
