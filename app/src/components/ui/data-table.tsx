import { EmptyState } from "./card";

export type DataTableColumn<T> = {
  header: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
};

export type DataTableSelecao = {
  selecionados: Set<string>;
  onToggle: (id: string) => void;
  onToggleTodos: () => void;
  todosSelecionados: boolean;
};

type DataTableProps<T> = {
  rows: T[];
  columns: DataTableColumn<T>[];
  keyField: (row: T) => string;
  emptyMessage: string;
  selecao?: DataTableSelecao;
  // lista + painel de detalhe: linha clicável e destaque da selecionada
  onLinhaClick?: (row: T) => void;
  linhaAtiva?: (row: T) => boolean;
};

export function DataTable<T>({
  rows,
  columns,
  keyField,
  emptyMessage,
  selecao,
  onLinhaClick,
  linhaAtiva,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <EmptyState>{emptyMessage}</EmptyState>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
            {selecao && (
              <th className="w-8 py-2.5 pl-3 pr-2">
                <input
                  type="checkbox"
                  checked={selecao.todosSelecionados}
                  onChange={selecao.onToggleTodos}
                  aria-label="Selecionar todos"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.header}
                className={`py-2.5 pr-4 font-semibold first:pl-3 last:pr-3 ${col.align === "right" ? "text-right" : "text-left"}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = keyField(row);
            return (
              <tr
                key={id}
                onClick={onLinhaClick ? () => onLinhaClick(row) : undefined}
                aria-selected={linhaAtiva ? linhaAtiva(row) : undefined}
                className={`border-b border-gray-100 last:border-0 dark:border-gray-800 ${onLinhaClick ? "cursor-pointer" : ""} ${
                  linhaAtiva?.(row)
                    ? "bg-indigo-50 shadow-[inset_3px_0_0_var(--color-indigo-700)] dark:bg-indigo-950/60"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
                }`}
              >
                {selecao && (
                  // o clique no checkbox não abre o detalhe da linha
                  <td className="w-8 py-2.5 pl-3 pr-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selecao.selecionados.has(id)}
                      onChange={() => selecao.onToggle(id)}
                      aria-label="Selecionar linha"
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.header}
                    className={`py-2.5 pr-4 text-gray-700 first:pl-3 first:font-medium first:text-gray-900 last:pr-3 dark:text-gray-300 dark:first:text-gray-100 ${col.align === "right" ? "text-right tabular-nums" : "text-left"}`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
