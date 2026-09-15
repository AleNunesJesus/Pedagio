import { notFound, redirect } from "next/navigation";
import { getMeuPapel } from "@/lib/auth/guards";
import { getTarifaEstacionamento, listEstacionamentos } from "@/features/cadastros/queries";
import { TarifaEstacionamentoForm } from "@/features/cadastros/components/tarifa-estacionamento-form";

export default async function EditarTarifaEstacionamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const papel = await getMeuPapel();
  if (papel !== "admin") redirect("/cadastros/tarifas-estacionamento");

  const { id } = await params;
  const [tarifa, estacionamentos] = await Promise.all([
    getTarifaEstacionamento(id),
    listEstacionamentos(),
  ]);

  if (!tarifa) notFound();

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
        Editar tarifa
      </h2>
      <TarifaEstacionamentoForm estacionamentos={estacionamentos} tarifa={tarifa} />
    </section>
  );
}
