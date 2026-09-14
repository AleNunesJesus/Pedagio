import { notFound, redirect } from "next/navigation";
import { getMeuPapel } from "@/lib/auth/guards";
import { getCategoria } from "@/features/cadastros/queries";
import { CategoriaForm } from "@/features/cadastros/components/categoria-form";

export default async function EditarCategoriaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const papel = await getMeuPapel();
  if (papel !== "admin") redirect("/cadastros/categorias");

  const { id } = await params;
  const categoria = await getCategoria(id);

  if (!categoria) notFound();

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
        Editar categoria — {categoria.codigo}
      </h2>
      <CategoriaForm categoria={categoria} />
    </section>
  );
}
