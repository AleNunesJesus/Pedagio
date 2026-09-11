import { listLotesImportacao } from "@/features/importacao/queries";
import { ImportarForm } from "@/features/importacao/components/importar-form";
import { LoteList } from "@/features/importacao/components/lote-list";

export default async function ImportacaoPage() {
  const lotes = await listLotesImportacao();

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Importação</h1>

      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
          Nova importação de passagens
        </h2>
        <ImportarForm />
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
          Histórico de importações
        </h2>
        <LoteList rows={lotes} />
      </section>
    </main>
  );
}
