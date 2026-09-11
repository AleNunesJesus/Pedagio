import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { formatBRL } from "@/lib/format";
import { statusLabel } from "@/lib/status-validacao";

type Passagem = {
  passagem_id: string | null;
  numero_fatura: string | null;
  data_hora: string | null;
  placa: string | null;
  praca_nome: string | null;
  tipo_uso: string | null;
  valor_cobrado: number | null;
  status_validacao: string | null;
};

const LABEL_TIPO_USO: Record<string, string> = {
  passagem: "Passagem",
  contrato: "Contrato",
};

export function PassagensTable({ rows }: { rows: Passagem[] }) {
  return (
    <DataTable
      rows={rows}
      keyField={(row) => row.passagem_id ?? ""}
      emptyMessage="Nenhuma passagem encontrada para esse filtro."
      columns={[
        { header: "Fatura", render: (r) => r.numero_fatura ?? "—" },
        {
          header: "Data/hora",
          render: (r) => (r.data_hora ? new Date(r.data_hora).toLocaleString("pt-BR") : "—"),
        },
        { header: "Placa", render: (r) => r.placa ?? "—" },
        { header: "Praça", render: (r) => r.praca_nome ?? "—" },
        { header: "Tipo", render: (r) => (r.tipo_uso ? LABEL_TIPO_USO[r.tipo_uso] ?? r.tipo_uso : "—") },
        { header: "Valor", align: "right", render: (r) => formatBRL(r.valor_cobrado) },
        {
          header: "Status",
          render: (r) => (
            <Link
              href={`/passagens/${r.passagem_id}`}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {statusLabel(r.status_validacao)}
            </Link>
          ),
        },
      ]}
    />
  );
}
