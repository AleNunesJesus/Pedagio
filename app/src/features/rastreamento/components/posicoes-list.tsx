type Posicao = {
  id: number | null;
  latitude: number | null;
  longitude: number | null;
  data_hora: string | null;
  fonte: string | null;
};

const FONTE_LABEL: Record<string, string> = {
  carga_arquivo: "Arquivo",
  api: "API",
};

export function PosicoesList({ rows }: { rows: Posicao[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma posição encontrada.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <th className="py-2 pr-4 font-medium">Data/hora</th>
            <th className="py-2 pr-4 font-medium">Latitude</th>
            <th className="py-2 pr-4 font-medium">Longitude</th>
            <th className="py-2 pr-4 font-medium">Fonte</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-gray-100 dark:border-gray-900">
              <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">
                {row.data_hora ? new Date(row.data_hora).toLocaleString("pt-BR") : "—"}
              </td>
              <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{row.latitude ?? "—"}</td>
              <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{row.longitude ?? "—"}</td>
              <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">
                {row.fonte ? (FONTE_LABEL[row.fonte] ?? row.fonte) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
