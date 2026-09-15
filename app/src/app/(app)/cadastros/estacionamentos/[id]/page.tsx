import { notFound, redirect } from "next/navigation";
import { getMeuPapel } from "@/lib/auth/guards";
import { getEstacionamentoMapa } from "@/features/cadastros/queries";
import { EstacionamentoForm } from "@/features/cadastros/components/estacionamento-form";

export default async function EditarEstacionamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const papel = await getMeuPapel();
  if (papel !== "admin") redirect("/cadastros/estacionamentos");

  const { id } = await params;
  const estacionamento = await getEstacionamentoMapa(id);

  // id e poligono_geojson são NOT NULL na tabela real — a view só os tipa
  // como nullable porque é uma view genérica; o estacionamento já foi
  // confirmado existente logo abaixo.
  if (!estacionamento || !estacionamento.id || !estacionamento.nome || !estacionamento.poligono_geojson) notFound();

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
        Editar estacionamento
      </h2>
      <EstacionamentoForm
        estacionamento={{
          id: estacionamento.id,
          nome: estacionamento.nome,
          ativo: estacionamento.ativo ?? true,
          poligono_geojson: estacionamento.poligono_geojson as { type: "Polygon"; coordinates: number[][][] },
        }}
      />
    </section>
  );
}
