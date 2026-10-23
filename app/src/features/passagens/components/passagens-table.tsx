"use client";

import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { hrefCom } from "@/lib/href";
import { STATUS, STATUS_VALIDACAO_INFO, statusLabel } from "@/lib/status-validacao";
import { useSelecaoExclusao } from "@/hooks/use-selecao-exclusao";
import { tipoUsoLabel } from "@/lib/tipo-uso";
import { descreverEixos, motivoValorLabel } from "@/lib/motivo-valor";
import { excluirPassagens } from "../actions";

type Passagem = {
  passagem_id: string | null;
  data_hora: string | null;
  placa: string | null;
  praca_nome: string | null;
  estacionamento_nome: string | null;
  tipo_uso: string | null;
  valor_cobrado: number | null;
  status_validacao: string | null;
  eixos_composicao: number | null;
  eixos_cobrados: number | null;
  desconto_tag: boolean | null;
  motivo_valor: string | null;
};

type PassagensTableProps = {
  rows: Passagem[];
  podeExcluir: boolean;
  // sem searchParams (ex.: detalhe da fatura) o clique abre a página da passagem
  searchParams?: Record<string, string | undefined>;
  passagemAtiva?: string;
};

export function PassagensTable({ rows, podeExcluir, searchParams, passagemAtiva }: PassagensTableProps) {
  const router = useRouter();
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
        onLinhaClick={(r) =>
          r.passagem_id &&
          (searchParams
            ? router.push(hrefCom("/passagens", searchParams, { passagem: r.passagem_id }), { scroll: false })
            : router.push(`/passagens/${r.passagem_id}`))
        }
        linhaAtiva={(r) => !!passagemAtiva && r.passagem_id === passagemAtiva}
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
            render: (r) =>
              r.data_hora
                ? new Date(r.data_hora).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—",
          },
          { header: "Placa", render: (r) => <span className="font-mono text-xs">{r.placa ?? "—"}</span> },
          { header: "Praça", render: (r) => r.praca_nome ?? r.estacionamento_nome ?? "—" },
          { header: "Tipo", render: (r) => tipoUsoLabel(r.tipo_uso) },
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
                      ? "font-semibold text-red-700 dark:text-red-400"
                      : undefined
                  }
                >
                  {r.eixos_cobrados !== null ? `${r.eixos_cobrados}/${r.eixos_composicao}` : "≠"}
                  {r.desconto_tag && <span className="text-gray-400"> TAG</span>}
                </span>
              ),
          },
          { header: "Valor", align: "right", render: (r) => formatBRL(r.valor_cobrado) },
          {
            header: "Status",
            render: (r) => {
              const role = r.status_validacao ? STATUS_VALIDACAO_INFO[r.status_validacao]?.role : undefined;
              return (
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: STATUS[role ?? "neutral"] }}
                    aria-hidden
                  />
                  {statusLabel(r.status_validacao)}
                </span>
              );
            },
          },
        ]}
      />
    </div>
  );
}
