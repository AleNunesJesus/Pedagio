type Passo = {
  titulo: string;
  descricao: React.ReactNode;
};

/** Lista numerada de passos de um procedimento (importar arquivo, entrar no sistema etc.). */
export function Steps({ items }: { items: Passo[] }) {
  return (
    <ol className="mb-4 divide-y divide-gray-200 dark:divide-gray-800">
      {items.map((passo, indice) => (
        <li key={passo.titulo} className="flex gap-3 py-3 first:pt-0">
          <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            {indice + 1}
          </span>
          <div className="text-sm">
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {passo.titulo}
            </p>
            <p className="text-gray-500 dark:text-gray-400">{passo.descricao}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
