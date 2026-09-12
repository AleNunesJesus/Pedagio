"use client";

import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { useSelecaoExclusao } from "@/hooks/use-selecao-exclusao";
import { excluirPosicoes } from "../actions";

type Posicao = {
  id: number | null;
  latitude: number | null;
  longitude: number | null;
  data_hora: string | null;
  fonte: string | null;
};

const FONTE_LABEL: Record<string, string> = {
  carga_arquivo: "Arquivo",
  api: "API",
};

export function PosicoesList({ rows, podeExcluir }: { rows: Posicao[]; podeExcluir: boolean }) {
  const { selecionados, toggle, toggleTodos, excluirSelecionados, pending, erro } =
    useSelecaoExclusao(excluirPosicoes);
  const ids = rows.map((r) => String(r.id ?? ""));

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
        keyField={(row) => String(row.id ?? "")}
        emptyMessage="Nenhuma posição encontrada."
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
            header: "Data/hora",
            render: (r) => (r.data_hora ? new Date(r.data_hora).toLocaleString("pt-BR") : "—"),
          },
          { header: "Latitude", render: (r) => r.latitude ?? "—" },
          { header: "Longitude", render: (r) => r.longitude ?? "—" },
          { header: "Fonte", render: (r) => (r.fonte ? FONTE_LABEL[r.fonte] ?? r.fonte : "—") },
        ]}
      />
    </div>
  );
}
