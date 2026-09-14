"use client";

import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { useSelecaoExclusao } from "@/hooks/use-selecao-exclusao";
import { excluirTarifas } from "../actions";

type Tarifa = {
  id: string;
  valor: number;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  praca_pedagio: { nome: string } | null;
  categoria_veiculo: { codigo: string } | null;
};

export function TarifaList({ rows, isAdmin }: { rows: Tarifa[]; isAdmin: boolean }) {
  const { selecionados, toggle, toggleTodos, excluirSelecionados, pending, erro } =
    useSelecaoExclusao(excluirTarifas);
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
        emptyMessage="Nenhuma tarifa cadastrada ainda."
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
            header: "Praça",
            render: (r) =>
              isAdmin ? (
                <Link
                  href={`/cadastros/tarifas/${r.id}`}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {r.praca_pedagio?.nome ?? "—"}
                </Link>
              ) : (
                r.praca_pedagio?.nome ?? "—"
              ),
          },
          { header: "Categoria", render: (r) => r.categoria_veiculo?.codigo ?? "—" },
          { header: "Valor", align: "right", render: (r) => formatBRL(r.valor) },
          { header: "Início", render: (r) => r.vigencia_inicio },
          { header: "Fim", render: (r) => r.vigencia_fim ?? "vigente" },
        ]}
      />
    </div>
  );
}
