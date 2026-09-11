import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";

type Praca = {
  id: string;
  nome: string;
  rodovia: string | null;
  km: number | null;
  ativo: boolean;
};

export function PracaList({ rows, podeEditar }: { rows: Praca[]; podeEditar: boolean }) {
  return (
    <DataTable
      rows={rows}
      keyField={(row) => row.id}
      emptyMessage="Nenhuma praça cadastrada ainda."
      columns={[
        {
          header: "Nome",
          render: (r) =>
            podeEditar ? (
              <Link
                href={`/cadastros/pracas/${r.id}`}
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {r.nome}
              </Link>
            ) : (
              r.nome
            ),
        },
        { header: "Rodovia", render: (r) => r.rodovia ?? "—" },
        { header: "Km", align: "right", render: (r) => r.km ?? "—" },
        { header: "Ativa", render: (r) => (r.ativo ? "Sim" : "Não") },
      ]}
    />
  );
}
