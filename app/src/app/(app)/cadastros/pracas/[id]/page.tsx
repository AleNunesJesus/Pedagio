import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getMeuPapel } from "@/lib/auth/guards";
import { getOrigemCadastro, getPracaMapa } from "@/features/cadastros/queries";
import { PracaForm } from "@/features/cadastros/components/praca-form";

export default async function EditarPracaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const papel = await getMeuPapel();
  if (papel !== "admin") redirect("/cadastros/pracas");

  const { id } = await params;
  const praca = await getPracaMapa(id);

  // id é NOT NULL na tabela real — a view só o tipa como nullable porque é
  // uma view genérica. poligono_geojson pode ser nulo de verdade quando a
  // praça foi criada pela importação (cadastro pendente, FASE 22).
  if (!praca || !praca.id || !praca.nome) notFound();

  const origem = praca.cadastro_pendente ? await getOrigemCadastro(praca.criada_no_lote_id) : null;

  return (
    <div className="space-y-4">
      <Link
        href="/cadastros/pracas"
        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        ← Voltar para praças
      </Link>
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
            endereco: praca.endereco,
            municipio: praca.municipio,
            uf: praca.uf,
            ativo: praca.ativo ?? true,
            poligono_geojson: praca.poligono_geojson as { type: "Polygon"; coordinates: number[][][] } | null,
            cadastro_pendente: praca.cadastro_pendente ?? false,
            origem,
          }}
        />
      </section>
    </div>
  );
}
