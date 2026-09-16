type Props = {
  numero: string | null;
  status: string | null;
  candidatas: number | null;
  numeroBate: boolean | null;
};

export function VinculoViagemBadge({ numero, status, candidatas, numeroBate }: Props) {
  if (status === "vinculado") {
    return (
      <span
        title={
          numeroBate === null
            ? "Vínculo por placa + horário da viagem — fatura não informou número de viagem pra comparar"
            : numeroBate
              ? "Número da viagem informado na fatura confere com o do transporte"
              : "Vínculo por placa + horário da viagem — número informado na fatura não confere com o do transporte (numerações de sistemas diferentes, não é necessariamente erro)"
        }
      >
        {numero}
        {numeroBate === false && <span className="text-gray-400"> (nº não confere)</span>}
      </span>
    );
  }
  if (status === "ambiguo") {
    return (
      <span
        className="text-amber-600 dark:text-amber-400"
        title={`${candidatas} viagens de transporte cobrem o horário desta passagem — não é possível saber qual sem revisão manual`}
      >
        Ambíguo ({candidatas})
      </span>
    );
  }
  return <>—</>;
}
