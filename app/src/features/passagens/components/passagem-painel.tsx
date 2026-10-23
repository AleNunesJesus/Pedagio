import Link from "next/link";
import { FecharDetalhe } from "@/components/layout/lista-com-painel";
import { ValorSinalizado } from "@/components/ui/valor-sinalizado";
import { formatBRL, formatNumber } from "@/lib/format";
import { STATUS, STATUS_VALIDACAO_INFO, statusLabel } from "@/lib/status-validacao";
import { tipoUsoLabel } from "@/lib/tipo-uso";
import { descreverEixos, motivoValorLabel } from "@/lib/motivo-valor";
import type { getPassagemDetalhe } from "../queries";
import { VinculoViagemBadge } from "./vinculo-viagem-badge";

type Passagem = NonNullable<Awaited<ReturnType<typeof getPassagemDetalhe>>>;

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-600 dark:text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900 dark:text-gray-100">{children}</dd>
    </div>
  );
}

// Resumo da passagem selecionada na lista; o mapa e todos os campos ficam
// na página completa (/passagens/[id])
export function PassagemPainel({ passagem: p, hrefFechar }: { passagem: Passagem; hrefFechar: string }) {
  const role = p.status_validacao ? STATUS_VALIDACAO_INFO[p.status_validacao]?.role : undefined;
  const local = p.praca_nome ?? p.estacionamento_nome ?? "Praça não identificada";

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {p.data_hora ? new Date(p.data_hora).toLocaleString("pt-BR") : "—"}
          </p>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{local}</h2>
          <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">
            {[p.placa, p.frota ? `frota ${p.frota}` : null, p.rodovia].filter(Boolean).join(" · ")}
          </p>
        </div>
        <FecharDetalhe href={hrefFechar} />
      </div>

      <p className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-900 dark:bg-gray-800 dark:text-gray-100">
        <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS[role ?? "neutral"] }} />
        {statusLabel(p.status_validacao)}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-gray-100 p-3 dark:bg-gray-800">
          <p className="text-xs text-gray-600 dark:text-gray-400">Cobrado</p>
          <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatBRL(p.valor_cobrado)}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            esperado {p.valor_esperado === null ? "— sem tarifa" : formatBRL(p.valor_esperado)}
          </p>
        </div>
        <div
          className={`rounded-lg p-3 ${
            (p.divergencia_valor ?? 0) > 0
              ? "bg-red-50 dark:bg-red-950/50"
              : (p.divergencia_valor ?? 0) < 0
                ? "bg-green-50 dark:bg-green-950/50"
                : "bg-gray-100 dark:bg-gray-800"
          }`}
        >
          <p className="text-xs text-gray-600 dark:text-gray-400">Divergência</p>
          <p className="text-lg font-bold tabular-nums">
            {p.divergencia_valor === null ? "—" : <ValorSinalizado valor={p.divergencia_valor} />}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4">
        <Campo label="Tipo">{tipoUsoLabel(p.tipo_uso)}</Campo>
        <Campo label="Fatura">{p.numero_fatura ?? "—"}</Campo>
        <Campo label="GPS">
          {p.dentro_poligono === null
            ? "sem posição"
            : p.dentro_poligono
              ? "dentro do polígono"
              : `fora do polígono${p.distancia_metros !== null ? ` (${formatNumber(Math.round(p.distancia_metros))} m)` : ""}`}
        </Campo>
        <Campo label="Categoria">
          {p.categoria_codigo ?? "—"}
          {p.origem_categoria === "cadastro_veiculo" && <span className="text-gray-500"> (estimado)</span>}
        </Campo>
        <Campo label="Conferência por eixo">
          {p.motivo_valor ? (
            <span title={descreverEixos(p)}>{motivoValorLabel(p.motivo_valor)}</span>
          ) : (
            "—"
          )}
        </Campo>
        <Campo label="Embarcador">{p.embarcador ?? "—"}</Campo>
        <div className="col-span-2">
          <Campo label="Viagem (transporte)">
            <VinculoViagemBadge
              numero={p.viagem_transporte_numero}
              status={p.vinculo_viagem_status}
              candidatas={p.viagem_transporte_candidatas}
              numeroBate={p.numero_viagem_bate}
            />
          </Campo>
        </div>
      </dl>

      <Link
        href={`/passagens/${p.passagem_id}`}
        className="inline-block text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
      >
        Abrir passagem completa (com mapa) →
      </Link>
    </div>
  );
}
