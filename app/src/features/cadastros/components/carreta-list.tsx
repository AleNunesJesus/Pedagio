import { DataTable } from "@/components/ui/data-table";

type Carreta = {
  id: string;
  placa: string;
  tipo: string;
};

const LABEL_TIPO: Record<string, string> = {
  comum: "Comum (3 eixos)",
  vanderleia: "Vanderleia (4 eixos)",
};

export function CarretaList({ rows }: { rows: Carreta[] }) {
  return (
    <DataTable
      rows={rows}
      keyField={(row) => row.id}
      emptyMessage="Nenhuma carreta cadastrada ainda."
      columns={[
        { header: "Placa/código", render: (r) => r.placa },
        { header: "Tipo", render: (r) => LABEL_TIPO[r.tipo] ?? r.tipo },
      ]}
    />
  );
}
