type FluxoItem = { titulo: string; descricao?: string };

function FluxoBox({
  titulo,
  descricao,
  destaque = false,
}: FluxoItem & { destaque?: boolean }) {
  return (
    <div
      className={
        destaque
          ? "rounded-lg border-2 border-indigo-300 bg-indigo-50 p-3 text-center dark:border-indigo-800 dark:bg-indigo-950"
          : "rounded-lg border border-gray-200 bg-white p-3 text-center dark:border-gray-800 dark:bg-gray-900"
      }
    >
      <p
        className={
          destaque
            ? "text-sm font-medium text-indigo-900 dark:text-indigo-200"
            : "text-sm font-medium text-gray-900 dark:text-gray-100"
        }
      >
        {titulo}
      </p>
      {descricao && (
        <p
          className={
            destaque
              ? "mt-1 text-xs text-indigo-700 dark:text-indigo-300"
              : "mt-1 text-xs text-gray-500 dark:text-gray-400"
          }
        >
          {descricao}
        </p>
      )}
    </div>
  );
}

function Seta() {
  return (
    <div className="flex justify-center py-1 text-gray-300 dark:text-gray-700" aria-hidden="true">
      <span className="text-lg leading-none">↓</span>
    </div>
  );
}

/**
 * Fluxograma fim a fim do sistema: importação → validação automática →
 * status → telas de consulta/conciliação. Reaproveitado em "Primeiros
 * passos" (com texto explicativo ao redor) e em "Referência rápida"
 * (recapitulação visual) — mesmo diagrama nos dois lugares.
 */
export function FluxoGeral() {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/50">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <FluxoBox titulo="Passagens" descricao="planilha da fatura de pedágio" />
        <FluxoBox titulo="Posições de GPS" descricao="rastreamento dos veículos" />
        <FluxoBox titulo="Viagens" descricao="documento fiscal de transporte" />
      </div>

      <Seta />

      <FluxoBox
        destaque
        titulo="Validação automática"
        descricao="geoespacial (veículo dentro do polígono da praça?) + tarifária (valor cobrado × tarifa vigente) + vínculo com a viagem de transporte"
      />

      <Seta />

      <FluxoBox
        titulo="Status de validação"
        descricao="ok, valor divergente, fora do polígono, sem dados de GPS, etc."
      />

      <Seta />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <FluxoBox titulo="Painel" />
        <FluxoBox titulo="Faturas" />
        <FluxoBox titulo="Passagens" />
        <FluxoBox titulo="Crédito × débito" />
        <FluxoBox titulo="Viagens" />
        <FluxoBox titulo="Rastreamento" />
      </div>
    </div>
  );
}
