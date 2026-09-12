import { createClient } from "@/lib/supabase/server";

const POR_PAGINA = 50;

export type FaturaResumo = {
  numero_fatura: string | null;
  qtd_total: number | null;
  qtd_passagem: number | null;
  qtd_contrato: number | null;
  valor_total: number | null;
  valor_passagem: number | null;
  valor_contrato: number | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  qtd_ok: number | null;
  qtd_pendente: number | null;
  qtd_sem_dados_gps: number | null;
  qtd_sem_cadastro: number | null;
  qtd_valor_divergente: number | null;
  qtd_fora_poligono: number | null;
  qtd_local_e_valor_divergentes: number | null;
  qtd_nao_aplicavel: number | null;
};

export type FiltrosFaturas = {
  dataInicio?: string;
  dataFim?: string;
  pagina?: number;
};

export async function listFaturas(filtros: FiltrosFaturas) {
  const supabase = await createClient();
  const pagina = filtros.pagina && filtros.pagina > 0 ? filtros.pagina : 1;
  const de = (pagina - 1) * POR_PAGINA;
  const ate = de + POR_PAGINA - 1;

  let query = supabase
    .from("vw_fatura_resumo")
    .select("*", { count: "exact" })
    .order("periodo_fim", { ascending: false, nullsFirst: false })
    .range(de, ate);

  if (filtros.dataInicio) query = query.gte("periodo_fim", filtros.dataInicio);
  if (filtros.dataFim) query = query.lte("periodo_inicio", `${filtros.dataFim}T23:59:59`);

  const { data, count } = await query;

  return {
    rows: (data ?? []) as FaturaResumo[],
    total: count ?? 0,
    pagina,
    totalPaginas: Math.max(1, Math.ceil((count ?? 0) / POR_PAGINA)),
  };
}

export async function getFaturaResumo(numeroFatura: string | null): Promise<FaturaResumo | null> {
  const supabase = await createClient();
  let query = supabase.from("vw_fatura_resumo").select("*");
  query = numeroFatura === null ? query.is("numero_fatura", null) : query.eq("numero_fatura", numeroFatura);
  const { data } = await query.maybeSingle();
  return data as FaturaResumo | null;
}

export function qtdAtencao(f: FaturaResumo): number {
  return (f.qtd_total ?? 0) - (f.qtd_ok ?? 0) - (f.qtd_nao_aplicavel ?? 0);
}

export async function listPassagensDaFatura(numeroFatura: string | null) {
  const supabase = await createClient();
  let query = supabase
    .from("vw_passagens_detalhado")
    .select("*")
    .order("data_hora", { ascending: true });
  query = numeroFatura === null ? query.is("numero_fatura", null) : query.eq("numero_fatura", numeroFatura);
  const { data } = await query;
  return data ?? [];
}
