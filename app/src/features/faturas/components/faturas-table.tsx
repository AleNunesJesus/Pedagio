"use client";

import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import { formatBRL, formatNumber } from "@/lib/format";
import { hrefCom } from "@/lib/href";
import { STATUS } from "@/lib/status-validacao";
import { qtdAtencao, type FaturaResumo } from "../queries";

// fatura sem número vira "sem-fatura" na URL (mesma convenção de /faturas/[numero])
export function chaveFatura(numero: string | null) {
  return numero ?? "sem-fatura";
}

function formatData(data: string | null) {
  return data ? new Date(data).toLocaleDateString("pt-BR") : "—";
}

type FaturasTableProps = {
  rows: FaturaResumo[];
  searchParams: Record<string, string | undefined>;
  faturaAtiva?: string;
};

export function FaturasTable({ rows, searchParams, faturaAtiva }: FaturasTableProps) {
  const router = useRouter();
  return (
    <DataTable
      rows={rows}
      keyField={(row) => chaveFatura(row.numero_fatura)}
      emptyMessage="Nenhuma fatura encontrada para esse filtro."
      onLinhaClick={(r) =>
        router.push(hrefCom("/faturas", searchParams, { fatura: chaveFatura(r.numero_fatura) }), { scroll: false })
      }
      linhaAtiva={(r) => faturaAtiva === chaveFatura(r.numero_fatura)}
      columns={[
        { header: "Fatura", render: (r) => r.numero_fatura ?? "Sem fatura" },
        {
          header: "Período",
          render: (r) => `${formatData(r.periodo_inicio)} – ${formatData(r.periodo_fim)}`,
        },
        { header: "Passagens", align: "right", render: (r) => formatNumber(r.qtd_passagem ?? 0) },
        { header: "Linhas", align: "right", render: (r) => formatNumber(r.qtd_total ?? 0) },
        {
          header: "Valor total",
          align: "right",
          render: (r) => <span className="font-semibold text-gray-900 dark:text-gray-100">{formatBRL(r.valor_total)}</span>,
        },
        {
          header: "Situação",
          render: (r) => {
            const atencao = qtdAtencao(r);
            return (
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: atencao > 0 ? STATUS.warning : STATUS.good }}
                  aria-hidden
                />
                {atencao > 0 ? `${formatNumber(atencao)} pendente(s)` : "OK"}
              </span>
            );
          },
        },
      ]}
    />
  );
}
