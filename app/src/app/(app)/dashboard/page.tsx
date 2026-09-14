import Link from "next/link";
import { getDashboardData } from "@/features/dashboard/queries";
import { StatTile } from "@/components/ui/stat-tile";
import { Card } from "@/components/ui/card";
import { StatusResumo } from "@/features/dashboard/components/status-resumo";
import { DataTable } from "@/components/ui/data-table";
import { FinanceiroTrendChart } from "@/features/dashboard/components/financeiro-trend-chart";
import { ValoresTipoUsoChart } from "@/features/dashboard/components/valores-tipo-uso-chart";
import { ValoresVinculoViagemChart } from "@/features/dashboard/components/valores-vinculo-viagem-chart";
import { GastoPorPracaChart } from "@/features/dashboard/components/gasto-por-praca-chart";
import { TrendAreaChart } from "@/features/dashboard/components/trend-area-chart";
import { ValorSinalizado } from "@/components/ui/valor-sinalizado";
import { STATUS, STATUS_VALIDACAO_INFO } from "@/lib/status-validacao";
import { formatBRL, formatMonth, formatNumber, formatPercent } from "@/lib/format";

// total_esperado nulo (sem_cadastro/nao_aplicavel/pendente) não é "esperado
// zero" — é "não há tarifa de referência calculada para comparar".
function valorEsperadoLabel(valor: number | null): string {
  return valor === null ? "sem tarifa de referência" : formatBRL(valor);
}

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
          Divergência
        </h2>
        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
          Divergência = valor cobrado − tarifa vigente esperada. Positivo (
          <ValorSinalizado valor={1} />) é cobrado a mais que a tarifa;
          negativo (<ValorSinalizado valor={-1} />) é cobrado a menos.
        </p>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Por causa (status de validação)" subtitle="por que a divergência existe">
            <DataTable
              rows={data.divergenciaPorStatus}
              keyField={(row) => row.status_validacao ?? "—"}
              emptyMessage="Nenhuma passagem importada ainda."
              columns={[
                {
                  header: "Status",
                  render: (r) => {
                    const info = r.status_validacao
                      ? STATUS_VALIDACAO_INFO[r.status_validacao]
                      : undefined;
                    return (
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: STATUS[info?.role ?? "neutral"] }}
                          aria-hidden
                        />
                        {info?.label ?? r.status_validacao ?? "—"}
                      </span>
                    );
                  },
                },
                { header: "Qtd", align: "right", render: (r) => formatNumber(r.qtd_passagens) },
                { header: "Cobrado", align: "right", render: (r) => formatBRL(r.total_cobrado) },
                {
                  header: "Esperado",
                  align: "right",
                  render: (r) => valorEsperadoLabel(r.total_esperado),
                },
                {
                  header: "Divergência",
                  align: "right",
                  render: (r) => <ValorSinalizado valor={r.divergencia_valor} />,
                },
              ]}
            />
          </Card>
          <Card title="Onde se concentra — praças" subtitle="5 maiores desvios (em módulo)">
            <DataTable
              rows={data.topDivergenciaPorPraca}
              keyField={(row) => row.praca_id ?? "—"}
              emptyMessage="Nenhuma divergência de valor encontrada."
              columns={[
                { header: "Praça", render: (r) => r.praca_nome ?? "—" },
                { header: "Cobrado", align: "right", render: (r) => formatBRL(r.total_cobrado) },
                {
                  header: "Esperado",
                  align: "right",
                  render: (r) => valorEsperadoLabel(r.total_esperado),
                },
                {
                  header: "Divergência",
                  align: "right",
                  render: (r) => <ValorSinalizado valor={r.divergencia_valor} />,
                },
              ]}
            />
          </Card>
          <Card title="Onde se concentra — veículos" subtitle="5 maiores desvios (em módulo)">
            <DataTable
              rows={data.topDivergenciaPorVeiculo}
              keyField={(row) => row.veiculo_id ?? "—"}
              emptyMessage="Nenhuma divergência de valor encontrada."
              columns={[
                { header: "Placa", render: (r) => r.placa ?? "—" },
                { header: "Cobrado", align: "right", render: (r) => formatBRL(r.total_cobrado) },
                {
                  header: "Esperado",
                  align: "right",
                  render: (r) => valorEsperadoLabel(r.total_esperado),
                },
                {
                  header: "Divergência",
                  align: "right",
                  render: (r) => <ValorSinalizado valor={r.divergencia_valor} />,
                },
              ]}
            />
          </Card>
        </div>
      </section>

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
          Passagens por tipo de uso
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile
              label="Total em passagens"
              value={formatBRL(data.totalValorPassagem)}
            />
            <StatTile label="Qtd. passagens" value={formatNumber(data.totalQtdPassagem)} />
            <StatTile
              label="Total em contratos"
              value={formatBRL(data.totalValorContrato)}
            />
            <StatTile label="Qtd. contratos" value={formatNumber(data.totalQtdContrato)} />
          </div>
          <Card title="Valores por tipo de uso por mês" subtitle="passagem x contrato">
            <ValoresTipoUsoChart rows={data.valoresPorTipoUsoMensal} />
          </Card>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Passagens por vínculo de viagem
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Carregado" value={formatBRL(data.totalValorCarregado)} />
            <StatTile label="Qtd. carregado" value={formatNumber(data.totalQtdCarregado)} />
            <StatTile label="Vazio" value={formatBRL(data.totalValorVazio)} />
            <StatTile label="Qtd. vazio" value={formatNumber(data.totalQtdVazio)} />
            <StatTile label="Sem vínculo" value={formatBRL(data.totalValorSemVinculo)} />
            <StatTile label="Qtd. sem vínculo" value={formatNumber(data.totalQtdSemVinculo)} />
          </div>
          <Card
            title="Valores por vínculo de viagem por mês"
            subtitle="carregado x vazio x sem vínculo; só passagens reais (tipo_uso = passagem)"
          >
            <ValoresVinculoViagemChart rows={data.valoresPorVinculoViagemMensal} />
          </Card>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Crédito x débito (viagem/embarcador)
          </h2>
          <Link
            href="/credito-debito"
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            Ver todas as viagens →
          </Link>
        </div>
        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
          Por viagem/embarcador: o embarcador credita um valor que deveria ser
          compensado pelo débito na praça. Positivo (
          <ValorSinalizado valor={1} />) é a praça debitando mais do que foi
          creditado (prejuízo); negativo (<ValorSinalizado valor={-1} />) é o
          embarcador creditando mais do que foi debitado (ganho). Só
          passagens reais (tipo_uso = passagem) com viagem e embarcador
          identificados.
        </p>
        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile
            label="Diferença total"
            value={<ValorSinalizado valor={data.totalDiferencaCreditoDebito} />}
          />
          <StatTile label="Total creditado" value={formatBRL(data.totalCredito)} />
          <StatTile label="Total debitado" value={formatBRL(data.totalDebito)} />
          <StatTile
            label="Viagens com diferença"
            value={formatNumber(data.qtdViagensComDiferenca)}
          />
        </div>
        <Card title="Maiores diferenças por viagem" subtitle="top 5 em módulo">
          <DataTable
            rows={data.topCreditoDebitoPorViagem}
            keyField={(row) => row.viagem_id ?? "—"}
            emptyMessage="Nenhuma diferença entre crédito e débito encontrada."
            columns={[
              { header: "Viagem", render: (r) => r.viagem_numero ?? "—" },
              { header: "Embarcador", render: (r) => r.embarcador_nome ?? "—" },
              { header: "Creditado", align: "right", render: (r) => formatBRL(r.valor_credito) },
              { header: "Debitado", align: "right", render: (r) => formatBRL(r.valor_debito) },
              {
                header: "Diferença",
                align: "right",
                render: (r) => <ValorSinalizado valor={r.diferenca} />,
              },
            ]}
          />
        </Card>
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
