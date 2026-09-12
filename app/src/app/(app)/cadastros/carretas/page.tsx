import { getMeuPapel } from "@/lib/auth/guards";
import { listCarretas } from "@/features/cadastros/queries";
import { CarretaForm } from "@/features/cadastros/components/carreta-form";
import { CarretaList } from "@/features/cadastros/components/carreta-list";

export default async function CarretasPage() {
  const [carretas, papel] = await Promise.all([listCarretas(), getMeuPapel()]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Cadastro de carretas (placa/código → tipo), usado para determinar a
        quantidade de eixos de cada viagem de transporte (cavalo + carreta(s)
        engatada(s)) e assim conferir a tarifa correta por composição.
      </p>
      {papel === "admin" && (
        <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
            Nova carreta
          </h2>
          <CarretaForm />
        </section>
      )}
      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <CarretaList rows={carretas} />
      </section>
    </div>
  );
}
