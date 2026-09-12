"use client";

import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { useSelecaoExclusao } from "@/hooks/use-selecao-exclusao";
import { excluirLotes } from "../actions";

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
  viagens_transporte: "Viagens",
};

export function LoteList({ rows, podeExcluir }: { rows: Lote[]; podeExcluir: boolean }) {
  const { selecionados, toggle, toggleTodos, excluirSelecionados, pending, erro } =
    useSelecaoExclusao(excluirLotes);
  const ids = rows.map((r) => r.id);

  return (
    <div className="space-y-3">
      {podeExcluir && selecionados.size > 0 && (
        <div className="flex items-center gap-3">
          <Button variant="destructive" size="sm" disabled={pending} onClick={excluirSelecionados}>
            {pending ? "Excluindo..." : `Excluir lote(s) selecionado(s) (${selecionados.size})`}
          </Button>
          {erro && <span className="text-sm text-red-600 dark:text-red-400">{erro}</span>}
        </div>
      )}
      {podeExcluir && selecionados.size > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Excluir um lote apaga todas as linhas que vieram daquele arquivo (passagens, posições de
          GPS ou viagens, conforme o tipo).
        </p>
      )}

      <DataTable
        rows={rows}
        keyField={(row) => row.id}
        emptyMessage="Nenhuma importação realizada ainda."
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
    </div>
  );
}
