"use client";

import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { ValorSinalizado } from "@/components/ui/valor-sinalizado";
import { formatBRL } from "@/lib/format";
import { useSelecaoExclusao } from "@/hooks/use-selecao-exclusao";
import { excluirViagensTransporte } from "../actions";
import { hrefCom } from "@/lib/href";

type Viagem = {
  id: string | null;
  numero_transporte: string | null;
  placa_informada: string | null;
  cidade_origem: string | null;
  uf_origem: string | null;
  cidade_destino: string | null;
  uf_destino: string | null;
  data_hora_saida: string | null;
  tipo_viagem: string | null;
  valor_pedagios: number | null;
  divergencia_valor: number | null;
};

function formatSaida(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type ViagensTableProps = {
  rows: Viagem[];
  podeExcluir: boolean;
  searchParams: Record<string, string | undefined>;
  viagemAtiva?: string;
};

export function ViagensTable({ rows, podeExcluir, searchParams, viagemAtiva }: ViagensTableProps) {
  const router = useRouter();
  const { selecionados, toggle, toggleTodos, excluirSelecionados, pending, erro } =
    useSelecaoExclusao(excluirViagensTransporte);
  const ids = rows.map((r) => r.id ?? "");

  return (
    <div className="space-y-3">
      {podeExcluir && selecionados.size > 0 && (
        <div className="flex items-center gap-3">
          <Button variant="destructive" size="sm" disabled={pending} onClick={excluirSelecionados}>
            {pending ? "Excluindo..." : `Excluir selecionadas (${selecionados.size})`}
          </Button>
          {erro && <span className="text-sm text-red-600 dark:text-red-400">{erro}</span>}
        </div>
      )}

      <DataTable
        rows={rows}
        keyField={(row) => row.id ?? ""}
        emptyMessage="Nenhuma viagem encontrada para esse filtro."
        onLinhaClick={(r) =>
          r.id && router.push(hrefCom("/viagens-transporte", searchParams, { viagem: r.id }), { scroll: false })
        }
        linhaAtiva={(r) => !!viagemAtiva && r.id === viagemAtiva}
        selecao={
          podeExcluir
            ? {
                selecionados,
                onToggle: toggle,
                onToggleTodos: () => toggleTodos(ids),
                todosSelecionados: ids.length > 0 && ids.every((id) => selecionados.has(id)),
              }
            : undefined
        }
        columns={[
          {
            header: "Transporte",
            render: (r) => (
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    r.tipo_viagem === "carregado" ? "bg-indigo-600 dark:bg-indigo-400" : "bg-gray-400"
                  }`}
                />
                {r.numero_transporte ?? "—"}
              </span>
            ),
          },
          {
            header: "Placa",
            render: (r) => <span className="font-mono text-xs">{r.placa_informada ?? "—"}</span>,
          },
          {
            header: "Rota",
            render: (r) => (
              <span
                title={`${r.cidade_origem ?? "—"}/${r.uf_origem ?? "—"} → ${r.cidade_destino ?? "—"}/${r.uf_destino ?? "—"}`}
              >
                {r.cidade_origem ?? "—"} → {r.cidade_destino ?? "—"}
              </span>
            ),
          },
          { header: "Saída", render: (r) => formatSaida(r.data_hora_saida) },
          { header: "Pedágios", align: "right", render: (r) => formatBRL(r.valor_pedagios) },
          {
            header: "Divergência",
            align: "right",
            render: (r) => (
              <span className="font-semibold">
                <ValorSinalizado valor={r.divergencia_valor} />
              </span>
            ),
          },
        ]}
      />
      <div className="flex gap-4 text-xs text-gray-600 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
          Carregado
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-2 rounded-full bg-gray-400" />
          Vazio
        </span>
      </div>
    </div>
  );
}
