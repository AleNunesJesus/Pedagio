import { notFound, redirect } from "next/navigation";
import { getMeuPapel } from "@/lib/auth/guards";
import { getTarifa, listPracas, listCategorias } from "@/features/cadastros/queries";
import { TarifaForm } from "@/features/cadastros/components/tarifa-form";

export default async function EditarTarifaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const papel = await getMeuPapel();
  if (papel !== "admin") redirect("/cadastros/tarifas");

  const { id } = await params;
  const [tarifa, pracas, categorias] = await Promise.all([
    getTarifa(id),
    listPracas(),
    listCategorias(),
  ]);

  if (!tarifa) notFound();

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
        Editar tarifa
      </h2>
      <TarifaForm pracas={pracas} categorias={categorias} tarifa={tarifa} />
    </section>
  );
}
