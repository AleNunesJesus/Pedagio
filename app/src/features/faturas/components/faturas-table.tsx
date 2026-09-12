import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { formatBRL } from "@/lib/format";
import { STATUS } from "@/lib/status-validacao";
import { qtdAtencao, type FaturaResumo } from "../queries";

function formatPeriodo(inicio: string | null, fim: string | null) {
  if (!inicio || !fim) return "—";
  const di = new Date(inicio).toLocaleDateString("pt-BR");
  const df = new Date(fim).toLocaleDateString("pt-BR");
  return di === df ? di : `${di} – ${df}`;
}

export function FaturasTable({ rows }: { rows: FaturaResumo[] }) {
  return (
    <DataTable
      rows={rows}
      keyField={(row) => row.numero_fatura ?? "sem-fatura"}
      emptyMessage="Nenhuma fatura encontrada para esse filtro."
      columns={[
        {
          header: "Fatura",
          render: (r) => (
            <Link
              href={`/faturas/${r.numero_fatura ? encodeURIComponent(r.numero_fatura) : "sem-fatura"}`}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {r.numero_fatura ?? "Sem fatura"}
            </Link>
          ),
        },
        { header: "Período", render: (r) => formatPeriodo(r.periodo_inicio, r.periodo_fim) },
        { header: "Passagens", align: "right", render: (r) => r.qtd_passagem ?? 0 },
        { header: "Contrato", align: "right", render: (r) => r.qtd_contrato ?? 0 },
        { header: "Valor total", align: "right", render: (r) => formatBRL(r.valor_total) },
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
                {atencao > 0 ? `${atencao} pendente(s)` : "OK"}
              </span>
            );
          },
        },
      ]}
    />
  );
}
