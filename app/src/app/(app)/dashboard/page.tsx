import { getDashboardData } from "@/features/dashboard/queries";
import { StatTile } from "@/features/dashboard/components/stat-tile";
import { Card } from "@/features/dashboard/components/card";
import { StatusResumo } from "@/features/dashboard/components/status-resumo";
import { DataTable } from "@/features/dashboard/components/data-table";
import { FinanceiroTrendChart } from "@/features/dashboard/components/financeiro-trend-chart";
import { GastoPorPracaChart } from "@/features/dashboard/components/gasto-por-praca-chart";
import { TrendAreaChart } from "@/features/dashboard/components/trend-area-chart";
import { formatBRL, formatMonth, formatNumber, formatPercent } from "@/lib/format";

export default async function DashboardPage() {
  const data = await getDashboardData();

  const totalCobradoGeral = data.financeiroMensal.reduce(
    (acc, row) => acc + (row.total_cobrado ?? 0),
    0,
  );
  const divergenciaTotalGeral = data.financeiroMensal.reduce(
    (acc, row) => acc + (row.divergencia_total ?? 0),
    0,
  );

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Painel
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Visão geral de todo o período importado.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Praças cadastradas" value={formatNumber(data.totalPracas)} />
        <StatTile label="Veículos cadastrados" value={formatNumber(data.totalVeiculos)} />
        <StatTile label="Total cobrado" value={formatBRL(totalCobradoGeral)} />
        <StatTile label="Divergência total" value={formatBRL(divergenciaTotalGeral)} />
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Financeiro
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Cobrado vs. esperado por mês">
            <FinanceiroTrendChart rows={data.financeiroMensal} />
          </Card>
          <Card title="Gasto por praça" subtitle="top 10">
            <GastoPorPracaChart rows={data.gastoPorPraca} />
          </Card>
          <Card title="Gasto por veículo/mês" subtitle="top 10">
            <DataTable
              rows={data.gastoPorVeiculo}
              keyField={(row) => `${row.veiculo_id}-${row.mes}`}
              emptyMessage="Nenhuma passagem importada ainda."
              columns={[
                { header: "Placa", render: (r) => r.placa ?? "—" },
                { header: "Mês", render: (r) => (r.mes ? formatMonth(r.mes) : "—") },
                {
                  header: "Passagens",
                  align: "right",
                  render: (r) => formatNumber(r.qtd_passagens),
                },
                {
                  header: "Total cobrado",
                  align: "right",
                  render: (r) => formatBRL(r.total_cobrado),
                },
              ]}
            />
          </Card>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Auditoria / Validação
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Passagens por status">
            <StatusResumo rows={data.statusResumo} />
          </Card>
          <Card title="Passagens sem dados de GPS por dia">
            <TrendAreaChart
              rows={data.semDadosGpsPorDia.map((r) => ({
                dia: r.dia ?? "",
                valor: r.qtd_sem_dados_gps ?? 0,
              }))}
            />
          </Card>
          <Card title="Praças com maior taxa de fora do polígono">
            <DataTable
              rows={data.pracaTaxaForaPoligono}
              keyField={(row) => row.praca_id ?? ""}
              emptyMessage="Nenhuma praça com passagens ainda."
              columns={[
                { header: "Praça", render: (r) => r.praca_nome ?? "—" },
                { header: "Rodovia", render: (r) => r.rodovia ?? "—" },
                {
                  header: "Fora / total",
                  align: "right",
                  render: (r) => `${formatNumber(r.qtd_fora_poligono)} / ${formatNumber(r.qtd_total)}`,
                },
                {
                  header: "Taxa",
                  align: "right",
                  render: (r) => formatPercent(r.taxa_fora_poligono_pct),
                },
              ]}
            />
          </Card>
          <Card title="Veículos com maior taxa de divergência">
            <DataTable
              rows={data.veiculoTaxaDivergencia}
              keyField={(row) => row.veiculo_id ?? ""}
              emptyMessage="Nenhum veículo com passagens ainda."
              columns={[
                { header: "Placa", render: (r) => r.placa ?? "—" },
                {
                  header: "Divergentes / total",
                  align: "right",
                  render: (r) => `${formatNumber(r.qtd_divergente)} / ${formatNumber(r.qtd_total)}`,
                },
                {
                  header: "Taxa",
                  align: "right",
                  render: (r) => formatPercent(r.taxa_divergencia_pct),
                },
              ]}
            />
          </Card>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Operacional
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Volume de passagens por dia" subtitle="todas as praças">
            <TrendAreaChart
              rows={data.volumeTotalPorDia.map((r) => ({
                dia: r.dia,
                valor: r.qtd_passagens ?? 0,
              }))}
            />
          </Card>
          <Card
            title="Diferença de tempo média (GPS x passagem)"
            subtitle="por praça, em segundos"
          >
            <DataTable
              rows={data.diferencaTempoMedia}
              keyField={(row) => row.praca_id ?? ""}
              emptyMessage="Nenhuma passagem validada com GPS ainda."
              columns={[
                { header: "Praça", render: (r) => r.praca_nome ?? "—" },
                {
                  header: "Diferença média",
                  align: "right",
                  render: (r) => `${formatNumber(r.diferenca_media_segundos)}s`,
                },
                { header: "Amostras", align: "right", render: (r) => formatNumber(r.qtd) },
              ]}
            />
          </Card>
        </div>
      </section>
    </main>
  );
}
