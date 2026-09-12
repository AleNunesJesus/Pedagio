import { createClient } from "@/lib/supabase/server";

export async function getDashboardData() {
  const supabase = await createClient();

  const [
    { count: totalPracas },
    { count: totalVeiculos },
    { data: financeiroMensal },
    { data: valoresPorTipoUso },
    { data: valoresPorVinculoViagem },
    { data: gastoPorVeiculo },
    { data: gastoPorPraca },
    { data: statusResumo },
    { data: pracaTaxaForaPoligono },
    { data: veiculoTaxaDivergencia },
    { data: semDadosGpsPorDia },
    { data: diferencaTempoMedia },
    { data: volumePorPracaDia },
  ] = await Promise.all([
    supabase.from("praca_pedagio").select("*", { count: "exact", head: true }),
    supabase.from("veiculo").select("*", { count: "exact", head: true }),
    supabase.from("vw_financeiro_mensal").select("*").order("mes"),
    supabase.from("vw_valores_por_tipo_uso_mensal").select("*").order("mes"),
    supabase.from("vw_valores_por_vinculo_viagem_mensal").select("*").order("mes"),
    supabase
      .from("vw_gasto_por_veiculo_mensal")
      .select("*")
      .order("total_cobrado", { ascending: false })
      .limit(10),
    supabase
      .from("vw_gasto_por_praca")
      .select("*")
      .order("total_cobrado", { ascending: false })
      .limit(10),
    supabase.from("vw_status_resumo").select("*"),
    supabase
      .from("vw_praca_taxa_fora_poligono")
      .select("*")
      .order("taxa_fora_poligono_pct", { ascending: false })
      .limit(10),
    supabase
      .from("vw_veiculo_taxa_divergencia")
      .select("*")
      .order("taxa_divergencia_pct", { ascending: false })
      .limit(10),
    supabase.from("vw_sem_dados_gps_por_dia").select("*").order("dia"),
    supabase
      .from("vw_diferenca_tempo_media_por_praca")
      .select("*")
      .order("diferenca_media_segundos", { ascending: false }),
    supabase.from("vw_volume_passagens_praca_dia").select("dia, qtd_passagens").order("dia"),
  ]);

  // vw_volume_passagens_praca_dia é por praça+dia; para a tendência geral do
  // painel somamos por dia (o detalhe por praça fica para uma tela futura de
  // drill-down, se for necessário).
  const volumePorDiaMap = new Map<string, number>();
  for (const linha of volumePorPracaDia ?? []) {
    if (!linha.dia) continue;
    volumePorDiaMap.set(
      linha.dia,
      (volumePorDiaMap.get(linha.dia) ?? 0) + (linha.qtd_passagens ?? 0),
    );
  }
  const volumeTotalPorDia = Array.from(volumePorDiaMap.entries())
    .map(([dia, qtd_passagens]) => ({ dia, qtd_passagens }))
    .sort((a, b) => a.dia.localeCompare(b.dia));

  // vw_valores_por_tipo_uso_mensal vem em formato longo (uma linha por
  // mês+tipo_uso); o gráfico de tendência precisa de uma linha por mês com
  // uma coluna por tipo_uso, então pivotamos aqui.
  const tipoUsoPorMesMap = new Map<
    string,
    { mes: string; valor_passagem: number; valor_contrato: number; qtd_passagem: number; qtd_contrato: number }
  >();
  let totalValorPassagem = 0;
  let totalQtdPassagem = 0;
  let totalValorContrato = 0;
  let totalQtdContrato = 0;
  for (const linha of valoresPorTipoUso ?? []) {
    if (!linha.mes) continue;
    const entry = tipoUsoPorMesMap.get(linha.mes) ?? {
      mes: linha.mes,
      valor_passagem: 0,
      valor_contrato: 0,
      qtd_passagem: 0,
      qtd_contrato: 0,
    };
    if (linha.tipo_uso === "passagem") {
      entry.valor_passagem += linha.total_cobrado ?? 0;
      entry.qtd_passagem += linha.qtd_passagens ?? 0;
      totalValorPassagem += linha.total_cobrado ?? 0;
      totalQtdPassagem += linha.qtd_passagens ?? 0;
    } else if (linha.tipo_uso === "contrato") {
      entry.valor_contrato += linha.total_cobrado ?? 0;
      entry.qtd_contrato += linha.qtd_passagens ?? 0;
      totalValorContrato += linha.total_cobrado ?? 0;
      totalQtdContrato += linha.qtd_passagens ?? 0;
    }
    tipoUsoPorMesMap.set(linha.mes, entry);
  }
  const valoresPorTipoUsoMensal = Array.from(tipoUsoPorMesMap.values()).sort((a, b) =>
    a.mes.localeCompare(b.mes),
  );

  // vw_valores_por_vinculo_viagem_mensal também vem em formato longo (uma
  // linha por mês+vínculo); mesmo pivotamento usado para tipo_uso acima.
  const vinculoViagemPorMesMap = new Map<
    string,
    { mes: string; valor_carregado: number; valor_vazio: number; valor_sem_vinculo: number }
  >();
  let totalValorCarregado = 0;
  let totalQtdCarregado = 0;
  let totalValorVazio = 0;
  let totalQtdVazio = 0;
  let totalValorSemVinculo = 0;
  let totalQtdSemVinculo = 0;
  for (const linha of valoresPorVinculoViagem ?? []) {
    if (!linha.mes) continue;
    const entry = vinculoViagemPorMesMap.get(linha.mes) ?? {
      mes: linha.mes,
      valor_carregado: 0,
      valor_vazio: 0,
      valor_sem_vinculo: 0,
    };
    if (linha.vinculo === "carregado") {
      entry.valor_carregado += linha.total_cobrado ?? 0;
      totalValorCarregado += linha.total_cobrado ?? 0;
      totalQtdCarregado += linha.qtd_passagens ?? 0;
    } else if (linha.vinculo === "vazio") {
      entry.valor_vazio += linha.total_cobrado ?? 0;
      totalValorVazio += linha.total_cobrado ?? 0;
      totalQtdVazio += linha.qtd_passagens ?? 0;
    } else {
      entry.valor_sem_vinculo += linha.total_cobrado ?? 0;
      totalValorSemVinculo += linha.total_cobrado ?? 0;
      totalQtdSemVinculo += linha.qtd_passagens ?? 0;
    }
    vinculoViagemPorMesMap.set(linha.mes, entry);
  }
  const valoresPorVinculoViagemMensal = Array.from(vinculoViagemPorMesMap.values()).sort((a, b) =>
    a.mes.localeCompare(b.mes),
  );

  return {
    totalPracas: totalPracas ?? 0,
    totalVeiculos: totalVeiculos ?? 0,
    financeiroMensal: financeiroMensal ?? [],
    gastoPorVeiculo: gastoPorVeiculo ?? [],
    gastoPorPraca: gastoPorPraca ?? [],
    statusResumo: statusResumo ?? [],
    pracaTaxaForaPoligono: pracaTaxaForaPoligono ?? [],
    veiculoTaxaDivergencia: veiculoTaxaDivergencia ?? [],
    semDadosGpsPorDia: semDadosGpsPorDia ?? [],
    diferencaTempoMedia: diferencaTempoMedia ?? [],
    volumeTotalPorDia,
    valoresPorTipoUsoMensal,
    totalValorPassagem,
    totalQtdPassagem,
    totalValorContrato,
    totalQtdContrato,
    valoresPorVinculoViagemMensal,
    totalValorCarregado,
    totalQtdCarregado,
    totalValorVazio,
    totalQtdVazio,
    totalValorSemVinculo,
    totalQtdSemVinculo,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
