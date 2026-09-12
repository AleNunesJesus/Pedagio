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
};

export function DataTable<T>({
  rows,
  columns,
  keyField,
  emptyMessage,
  selecao,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <EmptyState>{emptyMessage}</EmptyState>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500 dark:border-gray-800 dark:text-gray-400">
            {selecao && (
              <th className="w-8 py-2 pr-2">
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
                className={`py-2 pr-4 font-medium last:pr-0 ${col.align === "right" ? "text-right" : "text-left"}`}
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
                className="border-b border-gray-100 last:border-0 dark:border-gray-900"
              >
                {selecao && (
                  <td className="w-8 py-2 pr-2">
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
                    className={`py-2 pr-4 text-gray-900 last:pr-0 dark:text-gray-100 ${col.align === "right" ? "text-right tabular-nums" : "text-left"}`}
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
