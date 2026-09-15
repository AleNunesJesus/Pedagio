"use client";

import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { useSelecaoExclusao } from "@/hooks/use-selecao-exclusao";
import { excluirEstacionamentos } from "../actions";

type Estacionamento = {
  id: string;
  nome: string;
  ativo: boolean;
};

export function EstacionamentoList({ rows, isAdmin }: { rows: Estacionamento[]; isAdmin: boolean }) {
  const { selecionados, toggle, toggleTodos, excluirSelecionados, pending, erro } =
    useSelecaoExclusao(excluirEstacionamentos);
  const ids = rows.map((r) => r.id);

  return (
    <div className="space-y-3">
      {isAdmin && selecionados.size > 0 && (
        <div className="flex items-center gap-3">
          <Button variant="destructive" size="sm" disabled={pending} onClick={excluirSelecionados}>
            {pending ? "Excluindo..." : `Excluir selecionados (${selecionados.size})`}
          </Button>
          {erro && <span className="text-sm text-red-600 dark:text-red-400">{erro}</span>}
        </div>
      )}

      <DataTable
        rows={rows}
        keyField={(row) => row.id}
        emptyMessage="Nenhum estacionamento cadastrado ainda."
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
            header: "Nome",
            render: (r) =>
              isAdmin ? (
                <Link
                  href={`/cadastros/estacionamentos/${r.id}`}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {r.nome}
                </Link>
              ) : (
                r.nome
              ),
          },
          { header: "Ativo", render: (r) => (r.ativo ? "Sim" : "Não") },
        ]}
      />
    </div>
  );
}
