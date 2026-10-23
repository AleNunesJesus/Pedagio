"use client";

import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { STATUS, STATUS_VALIDACAO_INFO, statusLabel } from "@/lib/status-validacao";
import { useSelecaoExclusao } from "@/hooks/use-selecao-exclusao";
import { tipoUsoLabel } from "@/lib/tipo-uso";
import { descreverEixos, motivoValorLabel } from "@/lib/motivo-valor";
import { excluirPassagens } from "../actions";
import { VinculoViagemBadge } from "./vinculo-viagem-badge";

type Passagem = {
  passagem_id: string | null;
  numero_fatura: string | null;
  data_hora: string | null;
  placa: string | null;
  frota: string | null;
  praca_nome: string | null;
  estacionamento_nome: string | null;
  tipo_uso: string | null;
  valor_cobrado: number | null;
  status_validacao: string | null;
  categoria_codigo: string | null;
  origem_categoria: string | null;
  viagem_transporte_numero: string | null;
  vinculo_viagem_status: string | null;
  viagem_transporte_candidatas: number | null;
  numero_viagem_bate: boolean | null;
  eixos_composicao: number | null;
  eixos_cobrados: number | null;
  desconto_tag: boolean | null;
  motivo_valor: string | null;
};



export function PassagensTable({ rows, podeExcluir }: { rows: Passagem[]; podeExcluir: boolean }) {
  const { selecionados, toggle, toggleTodos, excluirSelecionados, pending, erro } =
    useSelecaoExclusao(excluirPassagens);
  const ids = rows.map((r) => r.passagem_id ?? "");

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
        keyField={(row) => row.passagem_id ?? ""}
        emptyMessage="Nenhuma passagem encontrada para esse filtro."
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
          { header: "Fatura", render: (r) => r.numero_fatura ?? "—" },
          {
            header: "Data/hora",
            render: (r) => (r.data_hora ? new Date(r.data_hora).toLocaleString("pt-BR") : "—"),
          },
          { header: "Placa", render: (r) => r.placa ?? "—" },
          { header: "Frota", render: (r) => r.frota ?? "—" },
          { header: "Praça", render: (r) => r.praca_nome ?? r.estacionamento_nome ?? "—" },
          { header: "Tipo", render: (r) => tipoUsoLabel(r.tipo_uso) },
          {
            header: "Categoria",
            render: (r) =>
              r.categoria_codigo ? (
                <span title={r.origem_categoria === "cadastro_veiculo" ? "Composição da viagem não identificada — usando categoria cadastrada do veículo" : "Composição da viagem (cavalo + carreta(s))"}>
                  {r.categoria_codigo}
                  {r.origem_categoria === "cadastro_veiculo" && (
                    <span className="text-gray-400"> (estimado)</span>
                  )}
                </span>
              ) : (
                "—"
              ),
          },
          {
            header: "Viagem (transporte)",
            render: (r) => (
              <VinculoViagemBadge
                numero={r.viagem_transporte_numero}
                status={r.vinculo_viagem_status}
                candidatas={r.viagem_transporte_candidatas}
                numeroBate={r.numero_viagem_bate}
              />
            ),
          },
          { header: "Valor", align: "right", render: (r) => formatBRL(r.valor_cobrado) },
          {
            header: "Eixos",
            render: (r) =>
              !r.motivo_valor ? (
                <span className="text-gray-400" title="Sem conferência por eixo (sem tarifa, crédito ou sem cadastro)">—</span>
              ) : (
                <span
                  title={`${motivoValorLabel(r.motivo_valor)} — ${descreverEixos(r)}`}
                  className={
                    r.motivo_valor === "eixos_a_maior" || r.motivo_valor === "nao_multiplo"
                      ? "text-red-700 dark:text-red-400"
                      : undefined
                  }
                >
                  {r.eixos_cobrados !== null ? `${r.eixos_cobrados}/${r.eixos_composicao}` : "≠"}
                  {r.desconto_tag && <span className="text-gray-400"> TAG</span>}
                </span>
              ),
          },
          {
            header: "Status",
            render: (r) => {
              const role = r.status_validacao ? STATUS_VALIDACAO_INFO[r.status_validacao]?.role : undefined;
              return (
                <Link
                  href={`/passagens/${r.passagem_id}`}
                  className="inline-flex items-center gap-2 text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: STATUS[role ?? "neutral"] }}
                    aria-hidden
                  />
                  {statusLabel(r.status_validacao)}
                </Link>
              );
            },
          },
        ]}
      />
    </div>
  );
}
