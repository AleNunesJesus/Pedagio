import { listTarifas, listPracas, listCategorias } from "@/features/cadastros/queries";
import { TarifaForm } from "@/features/cadastros/components/tarifa-form";
import { TarifaList } from "@/features/cadastros/components/tarifa-list";

export default async function TarifasPage() {
  const [tarifas, pracas, categorias] = await Promise.all([
    listTarifas(),
    listPracas(),
    listCategorias(),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
          Nova tarifa
        </h2>
        {pracas.length === 0 || categorias.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Cadastre ao menos uma praça e uma categoria antes de definir tarifas.
          </p>
        ) : (
          <TarifaForm pracas={pracas} categorias={categorias} />
        )}
      </section>
      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <TarifaList rows={tarifas} />
      </section>
    </div>
  );
}
