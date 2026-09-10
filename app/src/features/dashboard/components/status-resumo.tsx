import { STATUS, STATUS_VALIDACAO_INFO } from "../colors";
import { formatNumber, formatPercent } from "@/lib/format";
import { EmptyState } from "./card";

type StatusResumoRow = {
  status_validacao: string | null;
  qtd: number | null;
  percentual: number | null;
};

// Cada status carrega cor + rótulo em texto (nunca só a cor) — status é
// estado, não identidade de série, por isso usa a paleta fixa de status.
export function StatusResumo({ rows }: { rows: StatusResumoRow[] }) {
  if (rows.length === 0) {
    return <EmptyState>Nenhuma passagem importada ainda.</EmptyState>;
  }

  const ordenadas = [...rows].sort((a, b) => (b.qtd ?? 0) - (a.qtd ?? 0));

  return (
    <ul className="space-y-2">
      {ordenadas.map((row) => {
        const info = row.status_validacao
          ? STATUS_VALIDACAO_INFO[row.status_validacao]
          : undefined;
        const label = info?.label ?? row.status_validacao ?? "—";
        const color = STATUS[info?.role ?? "neutral"];

        return (
          <li key={row.status_validacao}>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                {label}
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                {formatNumber(row.qtd)} ({formatPercent(row.percentual)})
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${row.percentual ?? 0}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
