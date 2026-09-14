"use client";

import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { useSelecaoExclusao } from "@/hooks/use-selecao-exclusao";
import { excluirCategorias } from "../actions";

type Categoria = { id: string; codigo: string; descricao: string; quantidade_eixos: number };

export function CategoriaList({ rows, isAdmin }: { rows: Categoria[]; isAdmin: boolean }) {
  const { selecionados, toggle, toggleTodos, excluirSelecionados, pending, erro } =
    useSelecaoExclusao(excluirCategorias);
  const ids = rows.map((r) => r.id);

  return (
    <div className="space-y-3">
      {isAdmin && selecionados.size > 0 && (
        <div className="flex items-center gap-3">
          <Button variant="destructive" size="sm" disabled={pending} onClick={excluirSelecionados}>
            {pending ? "Excluindo..." : `Excluir selecionadas (${selecionados.size})`}
          </Button>
          {erro && <span className="text-sm text-red-600 dark:text-red-400">{erro}</span>}
        </div>
      )}

      <DataTable
        rows={rows}
        keyField={(row) => row.id}
        emptyMessage="Nenhuma categoria cadastrada ainda."
        selecao={
          isAdmin
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
            header: "Código",
            render: (r) =>
              isAdmin ? (
                <Link
                  href={`/cadastros/categorias/${r.id}`}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {r.codigo}
                </Link>
              ) : (
                r.codigo
              ),
          },
          { header: "Descrição", render: (r) => r.descricao },
          { header: "Eixos", render: (r) => r.quantidade_eixos },
        ]}
      />
    </div>
  );
}
