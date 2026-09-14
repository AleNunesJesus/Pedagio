import { notFound } from "next/navigation";
import Link from "next/link";
import { getFaturaResumo, listPassagensDaFatura } from "@/features/faturas/queries";
import { PassagensTable } from "@/features/passagens/components/passagens-table";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, EmptyState } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { formatBRL } from "@/lib/format";
import { STATUS, STATUS_VALIDACAO_INFO } from "@/lib/status-validacao";
import { getMeuPapel } from "@/lib/auth/guards";

const ORDEM_STATUS = [
  "ok",
  "pendente",
  "sem_dados_gps",
  "sem_cadastro",
  "valor_divergente",
  "fora_poligono",
  "local_e_valor_divergentes",
  "nao_aplicavel",
] as const;

function formatData(data: string | null) {
  return data ? new Date(data).toLocaleDateString("pt-BR") : "—";
}

function agruparPorChave<T>(
  rows: T[],
  chave: (row: T) => string,
  valor: (row: T) => number | null,
) {
  const grupos = new Map<string, { label: string; qtd: number; total: number }>();
  for (const row of rows) {
    const label = chave(row);
    const atual = grupos.get(label) ?? { label, qtd: 0, total: 0 };
    atual.qtd += 1;
    atual.total += valor(row) ?? 0;
    grupos.set(label, atual);
  }
  return [...grupos.values()].sort((a, b) => b.total - a.total);
}

export default async function FaturaDetalhePage({
  params,
}: {
  params: Promise<{ numero: string }>;
}) {
  const { numero } = await params;
  const numeroFatura = numero === "sem-fatura" ? null : decodeURIComponent(numero);

  const [resumo, passagens, papel] = await Promise.all([
    getFaturaResumo(numeroFatura),
    listPassagensDaFatura(numeroFatura),
    getMeuPapel(),
  ]);

  if (!resumo) notFound();

  const qtdPorStatus: Record<string, number | null> = {
    ok: resumo.qtd_ok,
    pendente: resumo.qtd_pendente,
    sem_dados_gps: resumo.qtd_sem_dados_gps,
    sem_cadastro: resumo.qtd_sem_cadastro,
    valor_divergente: resumo.qtd_valor_divergente,
    fora_poligono: resumo.qtd_fora_poligono,
    local_e_valor_divergentes: resumo.qtd_local_e_valor_divergentes,
    nao_aplicavel: resumo.qtd_nao_aplicavel,
  };

  const porPraca = agruparPorChave(
    passagens,
    (p) => p.praca_nome ?? "Sem praça identificada",
    (p) => p.valor_cobrado,
  );
  const porVeiculo = agruparPorChave(
    passagens,
    (p) => p.placa ?? "Sem veículo identificado",
    (p) => p.valor_cobrado,
  );

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <Link href="/faturas" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        ← Voltar para faturas
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Fatura {resumo.numero_fatura ?? "Sem fatura"}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Período inicial" value={formatData(resumo.periodo_inicio)} />
        <StatTile label="Período final" value={formatData(resumo.periodo_fim)} />
        <StatTile label="Valor total a pagar" value={formatBRL(resumo.valor_total)} />
        <StatTile label="Valor passagens" value={formatBRL(resumo.valor_passagem)} />
        <StatTile label="Valor contrato" value={formatBRL(resumo.valor_contrato)} />
        <StatTile label="Total de linhas" value={String(resumo.qtd_total ?? 0)} />
      </div>

      <Card title="Situação das passagens" subtitle="Contagem por status de validação nesta fatura">
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {ORDEM_STATUS.filter((status) => (qtdPorStatus[status] ?? 0) > 0).map((status) => (
            <li key={status} className="inline-flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: STATUS[STATUS_VALIDACAO_INFO[status].role] }}
                aria-hidden
              />
              {STATUS_VALIDACAO_INFO[status].label}: {qtdPorStatus[status]}
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card title="Valor por praça">
          <DataTable
            rows={porPraca}
            keyField={(r) => r.label}
            emptyMessage="Sem dados."
            columns={[
              { header: "Praça", render: (r) => r.label },
              { header: "Qtd.", align: "right", render: (r) => r.qtd },
              { header: "Valor", align: "right", render: (r) => formatBRL(r.total) },
            ]}
          />
        </Card>
        <Card title="Valor por veículo">
          <DataTable
            rows={porVeiculo}
            keyField={(r) => r.label}
            emptyMessage="Sem dados."
            columns={[
              { header: "Placa", render: (r) => r.label },
              { header: "Qtd.", align: "right", render: (r) => r.qtd },
              { header: "Valor", align: "right", render: (r) => formatBRL(r.total) },
            ]}
          />
        </Card>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
          Passagens desta fatura
        </h2>
        {passagens.length === 0 ? (
          <EmptyState>Nenhuma passagem encontrada para esta fatura.</EmptyState>
        ) : (
          <PassagensTable rows={passagens} podeExcluir={papel === "admin"} />
        )}
      </section>
    </main>
  );
}
