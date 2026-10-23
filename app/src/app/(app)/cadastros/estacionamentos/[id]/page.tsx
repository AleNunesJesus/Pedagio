import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getMeuPapel } from "@/lib/auth/guards";
import { getEstacionamentoMapa, getOrigemCadastro } from "@/features/cadastros/queries";
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

  // id é NOT NULL na tabela real — a view só o tipa como nullable porque é
  // uma view genérica. poligono_geojson pode ser nulo de verdade quando o
  // estacionamento foi criado pela importação (cadastro pendente, FASE 22).
  if (!estacionamento || !estacionamento.id || !estacionamento.nome) notFound();

  const origem = estacionamento.cadastro_pendente
    ? await getOrigemCadastro(estacionamento.criada_no_lote_id)
    : null;

  return (
    <div className="space-y-4">
      <Link
        href="/cadastros/estacionamentos"
        className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
      >
        ← Voltar para estacionamentos
      </Link>
      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-100">
          Editar estacionamento
        </h2>
        <EstacionamentoForm
          estacionamento={{
            id: estacionamento.id,
            nome: estacionamento.nome,
            ativo: estacionamento.ativo ?? true,
            poligono_geojson: estacionamento.poligono_geojson as { type: "Polygon"; coordinates: number[][][] } | null,
            cadastro_pendente: estacionamento.cadastro_pendente ?? false,
            origem,
          }}
        />
      </section>
    </div>
  );
}
