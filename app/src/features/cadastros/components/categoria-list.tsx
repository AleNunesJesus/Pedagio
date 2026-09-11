import { DataTable } from "@/components/ui/data-table";

type Categoria = { id: string; codigo: string; descricao: string };

export function CategoriaList({ rows }: { rows: Categoria[] }) {
  return (
    <DataTable
      rows={rows}
      keyField={(row) => row.id}
      emptyMessage="Nenhuma categoria cadastrada ainda."
      columns={[
        { header: "Código", render: (r) => r.codigo },
        { header: "Descrição", render: (r) => r.descricao },
      ]}
    />
  );
}
