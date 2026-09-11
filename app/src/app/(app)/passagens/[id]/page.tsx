import { notFound } from "next/navigation";
import Link from "next/link";
import { getPassagemDetalhe } from "@/features/passagens/queries";
import { formatBRL, formatNumber } from "@/lib/format";
import { STATUS, STATUS_VALIDACAO_INFO } from "@/lib/status-validacao";

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
            {
              label: "Data/hora",
              valor: passagem.data_hora ? new Date(passagem.data_hora).toLocaleString("pt-BR") : "—",
            },
            { label: "Placa", valor: passagem.placa ?? "—" },
            { label: "Praça", valor: passagem.praca_nome ?? "—" },
            { label: "Rodovia", valor: passagem.rodovia ?? "—" },
            { label: "Valor cobrado", valor: formatBRL(passagem.valor_cobrado) },
          ]}
        />
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
          Resultado da validação
        </h2>
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
            { label: "Valor esperado (tarifa vigente)", valor: formatBRL(passagem.valor_esperado) },
            {
              label: "Divergência de valor",
              valor: formatBRL(passagem.divergencia_valor),
            },
          ]}
        />
      </section>
    </main>
  );
}
