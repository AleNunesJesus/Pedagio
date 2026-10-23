import Link from "next/link";
import { hrefViagens } from "../href";

type PaginacaoProps = {
  pagina: number;
  totalPaginas: number;
  searchParams: Record<string, string | undefined>;
};

export function Paginacao({ pagina, totalPaginas, searchParams }: PaginacaoProps) {
  if (totalPaginas <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
      <span>
        Página {pagina} de {totalPaginas}
      </span>
      <div className="flex gap-3">
        {pagina > 1 && (
          <Link href={hrefViagens(searchParams, { pagina: String(pagina - 1) })} className="hover:underline">
            ← Anterior
          </Link>
        )}
        {pagina < totalPaginas && (
          <Link href={hrefViagens(searchParams, { pagina: String(pagina + 1) })} className="hover:underline">
            Próxima →
          </Link>
        )}
      </div>
    </div>
  );
}
