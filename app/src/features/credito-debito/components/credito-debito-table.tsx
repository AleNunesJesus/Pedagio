import { DataTable } from "@/components/ui/data-table";
import { ValorSinalizado } from "@/components/ui/valor-sinalizado";
import { STATUS } from "@/lib/status-validacao";
import { formatBRL, formatNumber } from "@/lib/format";
import type { CreditoDebitoPorViagem } from "../queries";
import { SITUACAO_INFO, situacaoDaLinha } from "../situacao";

export function CreditoDebitoTable({ rows }: { rows: CreditoDebitoPorViagem[] }) {
  return (
    <DataTable
      rows={rows}
      keyField={(row) => row.viagem_id ?? "—"}
      emptyMessage="Nenhuma viagem com crédito ou débito vinculados encontrada."
      columns={[
        { header: "Viagem", render: (r) => r.viagem_numero ?? "—" },
        { header: "Embarcador", render: (r) => r.embarcador_nome ?? "—" },
        {
          header: "Situação",
          render: (r) => {
            const info = SITUACAO_INFO[situacaoDaLinha(r)];
            return (
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: STATUS[info.role] }}
                  aria-hidden
                />
                {info.label}
              </span>
            );
          },
        },
        { header: "Qtd. créditos", align: "right", render: (r) => formatNumber(r.qtd_credito) },
        { header: "Creditado", align: "right", render: (r) => formatBRL(r.valor_credito) },
        { header: "Qtd. débitos", align: "right", render: (r) => formatNumber(r.qtd_debito) },
        { header: "Debitado", align: "right", render: (r) => formatBRL(r.valor_debito) },
        {
          header: "Diferença",
          align: "right",
          render: (r) => <ValorSinalizado valor={r.diferenca} />,
        },
      ]}
    />
  );
}
