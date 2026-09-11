import { DataTable } from "@/components/ui/data-table";

type Veiculo = {
  id: string;
  placa: string;
  frota: string | null;
  ativo: boolean;
  categoria_veiculo: { codigo: string; descricao: string } | null;
};

export function VeiculoList({ rows }: { rows: Veiculo[] }) {
  return (
    <DataTable
      rows={rows}
      keyField={(row) => row.id}
      emptyMessage="Nenhum veículo cadastrado ainda."
      columns={[
        { header: "Placa", render: (r) => r.placa },
        { header: "Categoria", render: (r) => r.categoria_veiculo?.codigo ?? "—" },
        { header: "Frota", render: (r) => r.frota ?? "—" },
        { header: "Ativo", render: (r) => (r.ativo ? "Sim" : "Não") },
      ]}
    />
  );
}
