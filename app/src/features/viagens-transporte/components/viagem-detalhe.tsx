import Link from "next/link";
import { FecharDetalhe } from "@/components/layout/lista-com-painel";
import { ValorSinalizado } from "@/components/ui/valor-sinalizado";
import { formatBRL } from "@/lib/format";
import { STATUS, STATUS_VALIDACAO_INFO, statusLabel } from "@/lib/status-validacao";
import type { getViagemDetalhe } from "../queries";

type Detalhe = NonNullable<Awaited<ReturnType<typeof getViagemDetalhe>>>;

const LABEL_TIPO_VIAGEM: Record<string, string> = {
  carregado: "Carregado",
  vazio: "Vazio",
};

// embed do PostgREST pode vir como objeto ou lista conforme a relação
function um<T>(x: T | T[] | null | undefined): T | null {
  if (Array.isArray(x)) return x[0] ?? null;
  return x ?? null;
}

function formatDataHora(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function ViagemDetalhe({ detalhe, hrefFechar }: { detalhe: Detalhe; hrefFechar: string }) {
  const { viagem: v, passagens } = detalhe;
  const subtitulo = [
    v.placa_informada,
    v.tipo_viagem ? LABEL_TIPO_VIAGEM[v.tipo_viagem] ?? v.tipo_viagem : null,
    v.embarcador_nome,
    v.frota ? `frota ${v.frota}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-600 dark:text-gray-400">Transporte</p>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{v.numero_transporte ?? "—"}</h2>
          <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{subtitulo}</p>
        </div>
        <FecharDetalhe href={hrefFechar} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-gray-100 p-3 dark:bg-gray-800">
          <p className="text-xs text-gray-600 dark:text-gray-400">Cobrado</p>
          <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {formatBRL(v.valor_pedagios)}
          </p>
          {!!v.valor_pedagios_estimado && (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {formatBRL(v.valor_pedagios_estimado)} estimado
            </p>
          )}
        </div>
        <div
          className={`rounded-lg p-3 ${
            (v.divergencia_valor ?? 0) > 0
              ? "bg-red-50 dark:bg-red-950/50"
              : (v.divergencia_valor ?? 0) < 0
                ? "bg-green-50 dark:bg-green-950/50"
                : "bg-gray-100 dark:bg-gray-800"
          }`}
        >
          <p className="text-xs text-gray-600 dark:text-gray-400">Divergência</p>
          <p className="text-lg font-bold tabular-nums">
            <ValorSinalizado valor={v.divergencia_valor} />
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            tarifa {formatBRL(v.valor_tarifa_esperada)}
          </p>
        </div>
      </div>

      <dl className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
        <div>
          <dt className="inline font-semibold">Saída: </dt>
          <dd className="inline">
            {formatDataHora(v.data_hora_saida)} · {v.cidade_origem ?? "—"}/{v.uf_origem ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="inline font-semibold">Chegada: </dt>
          <dd className="inline">
            {formatDataHora(v.data_hora_chegada)} · {v.cidade_destino ?? "—"}/{v.uf_destino ?? "—"}
          </dd>
        </div>
      </dl>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
          Pedágios da viagem ({passagens.length})
        </p>
        {passagens.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Nenhuma passagem desta placa entre a saída e a chegada.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {passagens.map((p) => {
              const praca = um(p.praca_pedagio);
              const validacao = um(p.validacao_passagem);
              const role = STATUS_VALIDACAO_INFO[p.status_validacao]?.role ?? "neutral";
              const gps = validacao?.dentro_poligono ? "confirmado no GPS" : "estimado";
              return (
                <li key={p.id}>
                  <Link
                    href={`/passagens/${p.id}`}
                    className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  >
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: STATUS[role] }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-gray-900 dark:text-gray-100">
                        {praca?.nome ?? p.praca_informada ?? "Praça não identificada"}
                      </span>
                      <span className="block text-xs text-gray-600 dark:text-gray-400">
                        {formatHora(p.data_hora)} · {statusLabel(p.status_validacao)} · {gps}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                      {formatBRL(p.valor_cobrado)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
