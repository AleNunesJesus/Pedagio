import { EmptyState } from "./card";

export type DataTableColumn<T> = {
  header: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
};

type DataTableProps<T> = {
  rows: T[];
  columns: DataTableColumn<T>[];
  keyField: (row: T) => React.Key;
  emptyMessage: string;
};

export function DataTable<T>({
  rows,
  columns,
  keyField,
  emptyMessage,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <EmptyState>{emptyMessage}</EmptyState>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500 dark:border-gray-800 dark:text-gray-400">
            {columns.map((col) => (
              <th
                key={col.header}
                className={`py-2 font-medium ${col.align === "right" ? "text-right" : "text-left"}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={keyField(row)}
              className="border-b border-gray-100 last:border-0 dark:border-gray-900"
            >
              {columns.map((col) => (
                <td
                  key={col.header}
                  className={`py-2 text-gray-900 dark:text-gray-100 ${col.align === "right" ? "text-right tabular-nums" : "text-left"}`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
