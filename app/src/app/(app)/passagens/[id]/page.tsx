import { notFound } from "next/navigation";
import Link from "next/link";
import { getPassagemDetalhe } from "@/features/passagens/queries";
import { getPracaMapa } from "@/features/cadastros/queries";
import { getPosicao } from "@/features/rastreamento/queries";
import { MapaValidacaoLoader } from "@/features/passagens/components/mapa-validacao-loader";
import { formatBRL, formatNumber } from "@/lib/format";
import { STATUS, STATUS_VALIDACAO_INFO } from "@/lib/status-validacao";

const LABEL_TIPO_USO: Record<string, string> = {
  passagem: "Passagem",
  contrato: "Contrato",
  estacionamento: "Estacionamento",
};

const LABEL_CONDICAO: Record<string, string> = {
  debito: "Débito",
  credito: "Crédito",
};

const LABEL_ORIGEM_CATEGORIA: Record<string, string> = {
  composicao_viagem: "Composição da viagem (cavalo + carreta(s))",
  cadastro_veiculo: "Cadastro do veículo (composição não identificada)",
};

type Campo = { label: string; valor: React.ReactNode };

function Campos({ campos }: { campos: Campo[] }) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {campos.map((campo) => (
        <div key={campo.label}>
          <dt className="text-xs uppercase text-gray-500 dark:text-gray-400">{campo.label}</dt>
          <dd className="mt-0.5 text-sm text-gray-900 dark:text-gray-100">{campo.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function PassagemDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const passagem = await getPassagemDetalhe(id);

  if (!passagem) notFound();

  const [praca, posicao] = await Promise.all([
    passagem.praca_id ? getPracaMapa(passagem.praca_id) : null,
    passagem.posicao_veiculo_id ? getPosicao(passagem.posicao_veiculo_id) : null,
  ]);

  const statusInfo = passagem.status_validacao
    ? STATUS_VALIDACAO_INFO[passagem.status_validacao]
    : undefined;
  const statusCor = STATUS[statusInfo?.role ?? "neutral"];
  const statusLabel = statusInfo?.label ?? passagem.status_validacao ?? "—";

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link href="/passagens" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
        ← Voltar para passagens
      </Link>

      <div className="flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ backgroundColor: statusCor }}
          aria-hidden
        />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{statusLabel}</h1>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">Passagem</h2>
        <Campos
          campos={[
            { label: "Fatura", valor: passagem.numero_fatura ?? "—" },
            {
              label: "Data/hora",
              valor: passagem.data_hora ? new Date(passagem.data_hora).toLocaleString("pt-BR") : "—",
            },
            { label: "Placa", valor: passagem.placa ?? "—" },
            { label: "Tipo de veículo (informado)", valor: passagem.tipo_veiculo_informado ?? "—" },
            {
              label: passagem.tipo_uso === "estacionamento" ? "Estacionamento" : "Praça",
              valor: passagem.praca_nome ?? passagem.estacionamento_nome ?? "—",
            },
            { label: "Rodovia", valor: passagem.rodovia ?? "—" },
            { label: "Sentido (informado)", valor: passagem.sentido_informado ?? "—" },
            {
              label: "Tipo de uso",
              valor: passagem.tipo_uso ? LABEL_TIPO_USO[passagem.tipo_uso] ?? passagem.tipo_uso : "—",
            },
            {
              label: "Condição",
              valor: passagem.condicao ? LABEL_CONDICAO[passagem.condicao] ?? passagem.condicao : "—",
            },
            { label: "Valor cobrado", valor: formatBRL(passagem.valor_cobrado) },
            { label: "Viagem", valor: passagem.viagem ?? "—" },
            { label: "Embarcador", valor: passagem.embarcador ?? "—" },
          ]}
        />
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
          Resultado da validação
        </h2>
        {passagem.tipo_uso === "estacionamento" ? (
          <Campos
            campos={[
              {
                label: "Entrada detectada (GPS)",
                valor: passagem.entrada_detectada
                  ? new Date(passagem.entrada_detectada).toLocaleString("pt-BR")
                  : "—",
              },
              {
                label: "Saída detectada (GPS)",
                valor: passagem.saida_detectada
                  ? new Date(passagem.saida_detectada).toLocaleString("pt-BR")
                  : "—",
              },
              { label: "Diárias detectadas", valor: passagem.diarias_detectadas ?? "—" },
              { label: "Valor esperado (diárias x tarifa vigente)", valor: formatBRL(passagem.valor_esperado) },
              { label: "Divergência de valor", valor: formatBRL(passagem.divergencia_valor) },
            ]}
          />
        ) : (
          <Campos
            campos={[
              {
                label: "Dentro do polígono",
                valor:
                  passagem.dentro_poligono === null
                    ? "sem dados"
                    : passagem.dentro_poligono
                      ? "Sim"
                      : "Não",
              },
              {
                label: "Distância até o polígono",
                valor:
                  passagem.distancia_metros !== null
                    ? `${formatNumber(passagem.distancia_metros)} m`
                    : "—",
              },
              {
                label: "Diferença de tempo (GPS x passagem)",
                valor:
                  passagem.diferenca_segundos !== null
                    ? `${formatNumber(passagem.diferenca_segundos)}s`
                    : "—",
              },
              {
                label: "Categoria usada (tarifa)",
                valor: passagem.categoria_codigo
                  ? `${passagem.categoria_codigo} — ${passagem.categoria_descricao}`
                  : "—",
              },
              {
                label: "Origem da categoria",
                valor: passagem.origem_categoria
                  ? LABEL_ORIGEM_CATEGORIA[passagem.origem_categoria] ?? passagem.origem_categoria
                  : "—",
              },
              { label: "Valor esperado (tarifa vigente)", valor: formatBRL(passagem.valor_esperado) },
              {
                label: "Divergência de valor",
                valor: formatBRL(passagem.divergencia_valor),
              },
            ]}
          />
        )}
      </section>

      {passagem.tipo_uso !== "estacionamento" && (
        <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
            Mapa da validação
          </h2>
          {praca?.poligono_geojson ? (
            <MapaValidacaoLoader
              poligono={praca.poligono_geojson as { type: "Polygon"; coordinates: number[][][] }}
              ponto={
                posicao && posicao.latitude !== null && posicao.longitude !== null && posicao.data_hora !== null
                  ? { latitude: posicao.latitude, longitude: posicao.longitude, data_hora: posicao.data_hora }
                  : null
              }
              dentroPoligono={passagem.dentro_poligono}
            />
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Praça não identificada para esta passagem — sem polígono para exibir.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
