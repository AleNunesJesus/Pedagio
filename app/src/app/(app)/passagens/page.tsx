import { listPassagens } from "@/features/passagens/queries";
import { listPracas, listVeiculos, listEmbarcadores } from "@/features/cadastros/queries";
import { FiltrosForm } from "@/features/passagens/components/filtros-form";
import { PassagensTable } from "@/features/passagens/components/passagens-table";
import { Paginacao } from "@/features/passagens/components/paginacao";
import { getMeuPapel } from "@/lib/auth/guards";

type SearchParams = {
  status?: string;
  pracaId?: string;
  veiculoId?: string;
  tipoUso?: string;
  embarcadorId?: string;
  viagem?: string;
  dataInicio?: string;
  dataFim?: string;
  pagina?: string;
};

export default async function PassagensPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const pagina = params.pagina ? Number(params.pagina) : 1;

  const [{ rows, total, totalPaginas }, pracas, veiculos, embarcadores, papel] = await Promise.all([
    listPassagens({
      status: params.status,
      pracaId: params.pracaId,
      veiculoId: params.veiculoId,
      tipoUso: params.tipoUso,
      embarcadorId: params.embarcadorId,
      viagem: params.viagem,
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
      pagina,
    }),
    listPracas(),
    listVeiculos(),
    listEmbarcadores(),
    getMeuPapel(),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Passagens</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{total} passagem(ns) encontrada(s).</p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <FiltrosForm
          pracas={pracas.map((p) => ({ id: p.id, nome: p.nome }))}
          veiculos={veiculos.map((v) => ({ id: v.id, nome: v.placa }))}
          embarcadores={embarcadores.map((e) => ({ id: e.id, nome: e.nome }))}
          valores={params}
        />
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <PassagensTable rows={rows} podeExcluir={papel === "admin"} />
        <Paginacao pagina={pagina} totalPaginas={totalPaginas} searchParams={params} />
      </section>
    </main>
  );
}
