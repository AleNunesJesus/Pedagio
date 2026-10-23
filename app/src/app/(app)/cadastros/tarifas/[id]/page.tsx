import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getMeuPapel } from "@/lib/auth/guards";
import { getTarifa, listPracas } from "@/features/cadastros/queries";
import { TarifaForm } from "@/features/cadastros/components/tarifa-form";

export default async function EditarTarifaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const papel = await getMeuPapel();
  if (papel !== "admin") redirect("/cadastros/tarifas");

  const { id } = await params;
  const [tarifa, pracas] = await Promise.all([getTarifa(id), listPracas()]);

  if (!tarifa) notFound();

  return (
    <main className="mx-auto max-w-[1800px] space-y-4 px-6 py-6">
      <Link
        href="/cadastros/tarifas"
        className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
      >
        ← Voltar para tarifas
      </Link>
      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
          Editar tarifa
        </h2>
        <TarifaForm pracas={pracas} tarifa={tarifa} />
      </section>
    </main>
  );
}
