import { DataTable } from "@/components/ui/data-table";
import { formatBRL } from "@/lib/format";

type Tarifa = {
  id: string;
  valor: number;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  praca_pedagio: { nome: string } | null;
  categoria_veiculo: { codigo: string } | null;
};

export function TarifaList({ rows }: { rows: Tarifa[] }) {
  return (
    <DataTable
      rows={rows}
      keyField={(row) => row.id}
      emptyMessage="Nenhuma tarifa cadastrada ainda."
      columns={[
        { header: "Praça", render: (r) => r.praca_pedagio?.nome ?? "—" },
        { header: "Categoria", render: (r) => r.categoria_veiculo?.codigo ?? "—" },
        { header: "Valor", align: "right", render: (r) => formatBRL(r.valor) },
        { header: "Início", render: (r) => r.vigencia_inicio },
        { header: "Fim", render: (r) => r.vigencia_fim ?? "vigente" },
      ]}
    />
  );
}
