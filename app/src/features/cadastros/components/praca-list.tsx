"use client";

import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { useSelecaoExclusao } from "@/hooks/use-selecao-exclusao";
import { excluirPracas } from "../actions";

type Praca = {
  id: string;
  nome: string;
  rodovia: string | null;
  km: number | null;
  ativo: boolean;
};

export function PracaList({ rows, isAdmin }: { rows: Praca[]; isAdmin: boolean }) {
  const { selecionados, toggle, toggleTodos, excluirSelecionados, pending, erro } =
    useSelecaoExclusao(excluirPracas);
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
        emptyMessage="Nenhuma praça cadastrada ainda."
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
    </div>
  );
}
