import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { formatBRL } from "@/lib/format";
import { STATUS, STATUS_VALIDACAO_INFO, statusLabel } from "@/lib/status-validacao";

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
          render: (r) => {
            const role = r.status_validacao ? STATUS_VALIDACAO_INFO[r.status_validacao]?.role : undefined;
            return (
              <Link
                href={`/passagens/${r.passagem_id}`}
                className="inline-flex items-center gap-2 text-blue-600 hover:underline dark:text-blue-400"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: STATUS[role ?? "neutral"] }}
                  aria-hidden
                />
                {statusLabel(r.status_validacao)}
              </Link>
            );
          },
        },
      ]}
    />
  );
}
