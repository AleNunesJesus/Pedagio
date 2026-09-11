import Link from "next/link";

type PaginacaoProps = {
  pagina: number;
  totalPaginas: number;
  searchParams: Record<string, string | undefined>;
};

function hrefParaPagina(searchParams: Record<string, string | undefined>, pagina: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== "pagina") params.set(key, value);
  }
  params.set("pagina", String(pagina));
  return `/viagens-transporte?${params.toString()}`;
}

export function Paginacao({ pagina, totalPaginas, searchParams }: PaginacaoProps) {
  if (totalPaginas <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
      <span>
        Página {pagina} de {totalPaginas}
      </span>
      <div className="flex gap-3">
        {pagina > 1 && (
          <Link href={hrefParaPagina(searchParams, pagina - 1)} className="hover:underline">
            ← Anterior
          </Link>
        )}
        {pagina < totalPaginas && (
          <Link href={hrefParaPagina(searchParams, pagina + 1)} className="hover:underline">
            Próxima →
          </Link>
        )}
      </div>
    </div>
  );
}
