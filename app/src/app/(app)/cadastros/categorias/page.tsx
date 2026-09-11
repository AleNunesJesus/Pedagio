import { getMeuPapel } from "@/lib/auth/guards";
import { listCategorias } from "@/features/cadastros/queries";
import { CategoriaForm } from "@/features/cadastros/components/categoria-form";
import { CategoriaList } from "@/features/cadastros/components/categoria-list";

export default async function CategoriasPage() {
  const [categorias, papel] = await Promise.all([listCategorias(), getMeuPapel()]);

  return (
    <div className="space-y-6">
      {papel === "admin" && (
        <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
            Nova categoria
          </h2>
          <CategoriaForm />
        </section>
      )}
      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <CategoriaList rows={categorias} />
      </section>
    </div>
  );
}
