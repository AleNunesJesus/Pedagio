"use client";

import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { useSelecaoExclusao } from "@/hooks/use-selecao-exclusao";
import { excluirVeiculos } from "../actions";

type Veiculo = {
  id: string;
  placa: string;
  tipo: string;
  frota: string | null;
  ativo: boolean;
  categoria_veiculo: { codigo: string; descricao: string; quantidade_eixos: number } | null;
  categoria_fallback: { codigo: string; descricao: string } | null;
};

const LABEL_TIPO: Record<string, string> = {
  cavalo: "Cavalo mecânico",
  carreta: "Carreta",
};

export function VeiculoList({ rows, isAdmin }: { rows: Veiculo[]; isAdmin: boolean }) {
  const { selecionados, toggle, toggleTodos, excluirSelecionados, pending, erro } =
    useSelecaoExclusao(excluirVeiculos);
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
        emptyMessage="Nenhum veículo cadastrado ainda."
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
            header: "Placa",
            render: (r) =>
              isAdmin ? (
                <Link
                  href={`/cadastros/veiculos/${r.id}`}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {r.placa}
                </Link>
              ) : (
                r.placa
              ),
          },
          { header: "Tipo", render: (r) => LABEL_TIPO[r.tipo] ?? r.tipo },
          {
            header: "Categoria (eixos próprios)",
            render: (r) =>
              r.categoria_veiculo
                ? `${r.categoria_veiculo.codigo} (${r.categoria_veiculo.quantidade_eixos} eixos)`
                : "—",
          },
          {
            header: "Fallback de tarifa",
            render: (r) => (r.tipo === "cavalo" ? r.categoria_fallback?.codigo ?? "—" : "—"),
          },
          { header: "Frota", render: (r) => r.frota ?? "—" },
          { header: "Ativo", render: (r) => (r.ativo ? "Sim" : "Não") },
        ]}
      />
    </div>
  );
}
