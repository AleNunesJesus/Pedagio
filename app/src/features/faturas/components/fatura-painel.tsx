import Link from "next/link";
import { FecharDetalhe } from "@/components/layout/lista-com-painel";
import { formatBRL, formatNumber } from "@/lib/format";
import { STATUS, STATUS_VALIDACAO_INFO } from "@/lib/status-validacao";
import type { FaturaResumo } from "../queries";

function formatData(data: string | null) {
  return data ? new Date(data).toLocaleDateString("pt-BR") : "—";
}

// status de validação → coluna de contagem na vw_fatura_resumo
const QTD_POR_STATUS: [string, keyof FaturaResumo][] = [
  ["ok", "qtd_ok"],
  ["valor_divergente", "qtd_valor_divergente"],
  ["fora_poligono", "qtd_fora_poligono"],
  ["local_e_valor_divergentes", "qtd_local_e_valor_divergentes"],
  ["sem_dados_gps", "qtd_sem_dados_gps"],
  ["sem_cadastro", "qtd_sem_cadastro"],
  ["pendente", "qtd_pendente"],
  ["nao_aplicavel", "qtd_nao_aplicavel"],
];

// Resumo da fatura selecionada na lista; passagens, praças e veículos ficam
// na página completa (/faturas/[numero])
export function FaturaPainel({ fatura: f, hrefFechar }: { fatura: FaturaResumo; hrefFechar: string }) {
  const valores = [
    { label: "Passagens", qtd: f.qtd_passagem, valor: f.valor_passagem },
    { label: "Contrato", qtd: f.qtd_contrato, valor: f.valor_contrato },
    { label: "Estacionamento", qtd: f.qtd_estacionamento, valor: f.valor_estacionamento },
    { label: "Adesão", qtd: f.qtd_adesao, valor: f.valor_adesao },
    { label: "Outras taxas", qtd: f.qtd_outras_taxas, valor: f.valor_outras_taxas },
    { label: "Crédito plano contratado", qtd: f.qtd_credito_plano_contratado, valor: f.valor_credito_plano_contratado },
  ].filter((v) => (v.qtd ?? 0) > 0);
  const total = f.qtd_total ?? 0;
  const status = QTD_POR_STATUS.map(([s, col]) => ({ s, qtd: Number(f[col] ?? 0) })).filter((x) => x.qtd > 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-600 dark:text-gray-400">Fatura</p>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{f.numero_fatura ?? "Sem fatura"}</h2>
          <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">
            {formatData(f.periodo_inicio)} – {formatData(f.periodo_fim)} · {formatNumber(total)} linha(s)
          </p>
        </div>
        <FecharDetalhe href={hrefFechar} />
      </div>

      <div className="rounded-lg bg-indigo-50 p-3 dark:bg-indigo-950/60">
        <p className="text-xs text-indigo-900 dark:text-indigo-200">Valor total a pagar</p>
        <p className="text-2xl font-bold tabular-nums text-indigo-800 dark:text-indigo-200">{formatBRL(f.valor_total)}</p>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">Por tipo</p>
        <ul className="divide-y divide-gray-100 text-sm dark:divide-gray-800">
          {valores.map((v) => (
            <li key={v.label} className="flex items-center gap-3 py-2">
              <span className="flex-1 text-gray-800 dark:text-gray-200">{v.label}</span>
              <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{formatNumber(v.qtd ?? 0)}</span>
              <span className="w-28 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                {formatBRL(v.valor)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
          Situação das linhas
        </p>
        <ul className="space-y-2.5 text-sm">
          {status.map(({ s, qtd }) => {
            const info = STATUS_VALIDACAO_INFO[s];
            const cor = STATUS[info.role];
            return (
              <li key={s}>
                <div className="flex items-center gap-2">
                  <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cor }} />
                  <span className="flex-1 text-gray-800 dark:text-gray-200">{info.label}</span>
                  <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(qtd)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className="h-full rounded-full" style={{ width: `${total ? (qtd / total) * 100 : 0}%`, backgroundColor: cor }} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <Link
        href={`/faturas/${f.numero_fatura ? encodeURIComponent(f.numero_fatura) : "sem-fatura"}`}
        className="inline-block text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
      >
        Abrir fatura completa (passagens, praças, veículos) →
      </Link>
    </div>
  );
}
