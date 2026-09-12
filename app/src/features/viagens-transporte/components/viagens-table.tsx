import { DataTable } from "@/components/ui/data-table";
import { formatBRL } from "@/lib/format";

type Viagem = {
  id: string | null;
  numero_transporte: string | null;
  placa_informada: string | null;
  cidade_origem: string | null;
  uf_origem: string | null;
  cidade_destino: string | null;
  uf_destino: string | null;
  data_hora_saida: string | null;
  data_hora_chegada: string | null;
  tipo_viagem: string | null;
  embarcador_nome: string | null;
  valor_pedagios: number | null;
  valor_tarifa_esperada: number | null;
  divergencia_valor: number | null;
};

const LABEL_TIPO_VIAGEM: Record<string, string> = {
  carregado: "Carregado",
  vazio: "Vazio",
};

export function ViagensTable({ rows }: { rows: Viagem[] }) {
  return (
    <DataTable
      rows={rows}
      keyField={(row) => row.id ?? ""}
      emptyMessage="Nenhuma viagem encontrada para esse filtro."
      columns={[
        { header: "Transporte", render: (r) => r.numero_transporte ?? "—" },
        { header: "Placa", render: (r) => r.placa_informada ?? "—" },
        {
          header: "Origem → Destino",
          render: (r) =>
            `${r.cidade_origem ?? "—"}/${r.uf_origem ?? "—"} → ${r.cidade_destino ?? "—"}/${r.uf_destino ?? "—"}`,
        },
        {
          header: "Saída",
          render: (r) => (r.data_hora_saida ? new Date(r.data_hora_saida).toLocaleString("pt-BR") : "—"),
        },
        {
          header: "Chegada",
          render: (r) => (r.data_hora_chegada ? new Date(r.data_hora_chegada).toLocaleString("pt-BR") : "—"),
        },
        {
          header: "Tipo",
          render: (r) => (r.tipo_viagem ? LABEL_TIPO_VIAGEM[r.tipo_viagem] ?? r.tipo_viagem : "—"),
        },
        { header: "Embarcador", render: (r) => r.embarcador_nome ?? "—" },
        { header: "Valor pedágios", align: "right", render: (r) => formatBRL(r.valor_pedagios) },
        { header: "Valor praça (tarifa)", align: "right", render: (r) => formatBRL(r.valor_tarifa_esperada) },
        { header: "Divergência", align: "right", render: (r) => formatBRL(r.divergencia_valor) },
      ]}
    />
  );
}
