import { listVeiculos } from "@/features/cadastros/queries";
import { listPosicoes } from "@/features/rastreamento/queries";
import { FiltrosForm } from "@/features/rastreamento/components/filtros-form";
import { MapaTrajetoLoader } from "@/features/rastreamento/components/mapa-trajeto-loader";
import { PosicoesList } from "@/features/rastreamento/components/posicoes-list";
import { getMeuPapel } from "@/lib/auth/guards";

type SearchParams = {
  veiculoId?: string;
  dataInicio?: string;
  dataFim?: string;
};

export default async function RastreamentoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [veiculos, papel, posicoes] = await Promise.all([
    listVeiculos(),
    getMeuPapel(),
    params.veiculoId ? listPosicoes(params) : Promise.resolve([]),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Rastreamento</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Posições de GPS de um veículo em um período.
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <FiltrosForm veiculos={veiculos.map((v) => ({ id: v.id, nome: v.placa }))} valores={params} />
      </section>

      {params.veiculoId ? (
        <>
          <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <MapaTrajetoLoader
              pontos={posicoes
                .filter((p) => p.latitude !== null && p.longitude !== null && p.data_hora !== null)
                .map((p) => ({ latitude: p.latitude!, longitude: p.longitude!, data_hora: p.data_hora! }))}
            />
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
              {posicoes.length} posição(ões) encontrada(s).
            </p>
            <PosicoesList rows={posicoes} podeExcluir={papel === "admin"} />
          </section>
        </>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Selecione um veículo para ver o trajeto.
        </p>
      )}
    </main>
  );
}
