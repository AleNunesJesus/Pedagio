import { createClient } from "@/lib/supabase/server";

export async function getDashboardData() {
  const supabase = await createClient();

  const [
    { count: totalPracas },
    { count: totalVeiculos },
    { data: financeiroMensal },
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
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
