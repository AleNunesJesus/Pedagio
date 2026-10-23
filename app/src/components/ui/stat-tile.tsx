// tom dá significado ao número (destaque, alerta, problema, ok); padrão neutro
export type StatTileTom = "neutro" | "destaque" | "alerta" | "perigo" | "sucesso";

const TOM_VALOR: Record<StatTileTom, string> = {
  neutro: "text-gray-900 dark:text-gray-100",
  destaque: "text-indigo-700 dark:text-indigo-300",
  alerta: "text-amber-700 dark:text-amber-400",
  perigo: "text-red-700 dark:text-red-400",
  sucesso: "text-green-700 dark:text-green-400",
};

type StatTileProps = {
  label: string;
  value: React.ReactNode;
  tom?: StatTileTom;
};

export function StatTile({ label, value, tom = "neutro" }: StatTileProps) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
      <p className={`mt-1 break-words text-2xl font-bold tabular-nums ${TOM_VALOR[tom]}`}>
        {value}
      </p>
    </div>
  );
}
