import { notFound } from "next/navigation";
import { getPracaMapa } from "@/features/cadastros/queries";
import { PracaForm } from "@/features/cadastros/components/praca-form";

export default async function EditarPracaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const praca = await getPracaMapa(id);

  // id e poligono_geojson são NOT NULL na tabela real — a view só os tipa
  // como nullable porque é uma view genérica; a praça já foi confirmada
  // existente logo abaixo.
  if (!praca || !praca.id || !praca.nome || !praca.poligono_geojson) notFound();

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
        Editar praça
      </h2>
      <PracaForm
        praca={{
          id: praca.id,
          nome: praca.nome,
          rodovia: praca.rodovia,
          concessionaria: praca.concessionaria,
          km: praca.km,
          sentido: praca.sentido,
          ativo: praca.ativo ?? true,
          poligono_geojson: praca.poligono_geojson as { type: "Polygon"; coordinates: number[][][] },
        }}
      />
    </section>
  );
}
