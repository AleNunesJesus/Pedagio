import { notFound, redirect } from "next/navigation";
import { getMeuPapel } from "@/lib/auth/guards";
import { getVeiculo, listCategorias } from "@/features/cadastros/queries";
import { VeiculoForm } from "@/features/cadastros/components/veiculo-form";

export default async function EditarVeiculoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const papel = await getMeuPapel();
  if (papel !== "admin") redirect("/cadastros/veiculos");

  const { id } = await params;
  const [veiculo, categorias] = await Promise.all([getVeiculo(id), listCategorias()]);

  if (!veiculo) notFound();

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
        Editar veículo/carreta — {veiculo.placa}
      </h2>
      <VeiculoForm categorias={categorias} veiculo={veiculo} />
    </section>
  );
}
