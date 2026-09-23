// Aviso informativo do manual ("dica"). Para avisos de atenção, as seções
// do manual reutilizam o componente Alert (variant="warning") já existente.
export function Dica({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-300">
      {children}
    </p>
  );
}
