import { DataTable } from "@/components/ui/data-table";
import { formatNumber } from "@/lib/format";

type Lote = {
  id: string;
  tipo: string;
  arquivo_nome: string | null;
  usuario: string | null;
  total_linhas: number | null;
  total_erros: number | null;
  created_at: string;
};

const TIPO_LABEL: Record<string, string> = {
  passagens: "Passagens",
  posicoes_gps: "GPS",
};

export function LoteList({ rows }: { rows: Lote[] }) {
  return (
    <DataTable
      rows={rows}
      keyField={(row) => row.id}
      emptyMessage="Nenhuma importação realizada ainda."
      columns={[
        { header: "Tipo", render: (r) => TIPO_LABEL[r.tipo] ?? r.tipo },
        { header: "Arquivo", render: (r) => r.arquivo_nome ?? "—" },
        { header: "Usuário", render: (r) => r.usuario ?? "—" },
        { header: "Linhas", align: "right", render: (r) => formatNumber(r.total_linhas) },
        { header: "Erros", align: "right", render: (r) => formatNumber(r.total_erros) },
        {
          header: "Data",
          render: (r) => new Date(r.created_at).toLocaleString("pt-BR"),
        },
      ]}
    />
  );
}
