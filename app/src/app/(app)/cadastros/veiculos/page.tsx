import { getMeuPapel } from "@/lib/auth/guards";
import { listVeiculos, listCategorias } from "@/features/cadastros/queries";
import { VeiculoForm } from "@/features/cadastros/components/veiculo-form";
import { VeiculoList } from "@/features/cadastros/components/veiculo-list";

export default async function VeiculosPage() {
  const [veiculos, categorias, papel] = await Promise.all([
    listVeiculos(),
    listCategorias(),
    getMeuPapel(),
  ]);

  return (
    <div className="space-y-6">
      {papel === "admin" && (
        <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
            Novo veículo
          </h2>
          {categorias.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Cadastre uma categoria antes de adicionar veículos.
            </p>
          ) : (
            <VeiculoForm categorias={categorias} />
          )}
        </section>
      )}
      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <VeiculoList rows={veiculos} />
      </section>
    </div>
  );
}
