import { listFaturas } from "@/features/faturas/queries";
import { FiltrosForm } from "@/features/faturas/components/filtros-form";
import { FaturasTable } from "@/features/faturas/components/faturas-table";
import { Paginacao } from "@/features/faturas/components/paginacao";

type SearchParams = {
  dataInicio?: string;
  dataFim?: string;
  pagina?: string;
};

export default async function FaturasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const pagina = params.pagina ? Number(params.pagina) : 1;

  const { rows, total, totalPaginas } = await listFaturas({
    dataInicio: params.dataInicio,
    dataFim: params.dataFim,
    pagina,
  });

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Faturas</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{total} fatura(s) encontrada(s).</p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <FiltrosForm valores={params} />
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <FaturasTable rows={rows} />
        <Paginacao pagina={pagina} totalPaginas={totalPaginas} searchParams={params} />
      </section>
    </main>
  );
}
