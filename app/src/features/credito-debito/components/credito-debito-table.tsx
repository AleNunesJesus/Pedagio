import { DataTable } from "@/components/ui/data-table";
import { ValorSinalizado } from "@/components/ui/valor-sinalizado";
import { formatBRL, formatNumber } from "@/lib/format";
import type { CreditoDebitoPorViagem } from "../queries";

export function CreditoDebitoTable({ rows }: { rows: CreditoDebitoPorViagem[] }) {
  return (
    <DataTable
      rows={rows}
      keyField={(row) => row.viagem_id ?? "—"}
      emptyMessage="Nenhuma viagem com crédito e débito vinculados encontrada."
      columns={[
        { header: "Viagem", render: (r) => r.viagem_numero ?? "—" },
        { header: "Embarcador", render: (r) => r.embarcador_nome ?? "—" },
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
