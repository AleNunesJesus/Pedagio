import { listVeiculos, listEmbarcadores } from "@/features/cadastros/queries";
import { listViagensTransporte } from "@/features/viagens-transporte/queries";
import { FiltrosForm } from "@/features/viagens-transporte/components/filtros-form";
import { ViagensTable } from "@/features/viagens-transporte/components/viagens-table";
import { Paginacao } from "@/features/viagens-transporte/components/paginacao";

type SearchParams = {
  veiculoId?: string;
  tipoViagem?: string;
  embarcadorId?: string;
  dataInicio?: string;
  dataFim?: string;
  pagina?: string;
};

export default async function ViagensTransportePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const pagina = params.pagina ? Number(params.pagina) : 1;

  const [{ rows, total, totalPaginas }, veiculos, embarcadores] = await Promise.all([
    listViagensTransporte({
      veiculoId: params.veiculoId,
      tipoViagem: params.tipoViagem,
      embarcadorId: params.embarcadorId,
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
      pagina,
    }),
    listVeiculos(),
    listEmbarcadores(),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Viagens</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{total} viagem(ns) encontrada(s).</p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <FiltrosForm
          veiculos={veiculos.map((v) => ({ id: v.id, nome: v.placa }))}
          embarcadores={embarcadores.map((e) => ({ id: e.id, nome: e.nome }))}
          valores={params}
        />
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <ViagensTable rows={rows} />
        <Paginacao pagina={pagina} totalPaginas={totalPaginas} searchParams={params} />
      </section>
    </main>
  );
}
