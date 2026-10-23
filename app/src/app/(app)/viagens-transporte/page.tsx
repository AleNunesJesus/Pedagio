import { listVeiculos, listEmbarcadores } from "@/features/cadastros/queries";
import { getViagemDetalhe, listViagensTransporte } from "@/features/viagens-transporte/queries";
import { FiltrosForm, FILTROS_FORM_ID } from "@/features/viagens-transporte/components/filtros-form";
import { ViagensTable } from "@/features/viagens-transporte/components/viagens-table";
import { ViagemDetalhe } from "@/features/viagens-transporte/components/viagem-detalhe";
import { Paginacao } from "@/features/viagens-transporte/components/paginacao";
import { hrefViagens } from "@/features/viagens-transporte/href";
import { getMeuPapel } from "@/lib/auth/guards";
import { formatNumber } from "@/lib/format";

type SearchParams = {
  busca?: string;
  veiculoId?: string;
  tipoViagem?: string;
  embarcadorId?: string;
  divergencia?: string;
  dataInicio?: string;
  dataFim?: string;
  pagina?: string;
  // viagem aberta no painel de detalhe
  viagem?: string;
};

export default async function ViagensTransportePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const pagina = params.pagina ? Number(params.pagina) : 1;

  const [{ erro, rows, total, totalPaginas, contagens }, detalhe, veiculos, embarcadores, papel] =
    await Promise.all([
      listViagensTransporte({
        busca: params.busca,
        veiculoId: params.veiculoId,
        tipoViagem: params.tipoViagem,
        embarcadorId: params.embarcadorId,
        divergencia: params.divergencia,
        dataInicio: params.dataInicio,
        dataFim: params.dataFim,
        pagina,
      }),
      params.viagem ? getViagemDetalhe(params.viagem) : Promise.resolve(null),
      listVeiculos(),
      listEmbarcadores(),
      getMeuPapel(),
    ]);

  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center gap-4 border-b border-gray-200 bg-white px-6 py-3.5 dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Viagens</h1>
        {erro ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            Não foi possível carregar as viagens ({erro}). Tente novamente.
          </p>
        ) : (
          <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-sm font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            {formatNumber(total)} viagem(ns)
          </span>
        )}
        <label className="flex h-10 w-full items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-600 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 sm:ml-auto sm:w-80 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden className="h-4 w-4 shrink-0">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            name="busca"
            form={FILTROS_FORM_ID}
            defaultValue={params.busca ?? ""}
            aria-label="Buscar transporte ou placa"
            placeholder="Buscar transporte ou placa"
            className="min-w-0 flex-1 bg-transparent text-gray-900 outline-none placeholder:text-gray-500 dark:text-gray-100"
          />
        </label>
      </header>

      <div className="grid flex-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_380px]">
        <aside className="border-b border-gray-200 bg-white p-5 lg:border-b-0 lg:border-r dark:border-gray-800 dark:bg-gray-900">
          <FiltrosForm
            veiculos={veiculos.map((v) => ({ id: v.id, nome: v.placa }))}
            embarcadores={embarcadores.map((e) => ({ id: e.id, nome: e.nome }))}
            valores={params}
            contagens={contagens}
          />
        </aside>

        <section className="min-w-0 p-5">
          <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
            <ViagensTable
              rows={rows}
              podeExcluir={papel === "admin"}
              searchParams={params}
              viagemAtiva={params.viagem}
            />
            <Paginacao pagina={pagina} totalPaginas={totalPaginas} searchParams={params} />
          </div>
        </section>

        <aside className="border-t border-gray-200 bg-white p-5 lg:col-span-2 xl:col-span-1 xl:border-l xl:border-t-0 dark:border-gray-800 dark:bg-gray-900">
          {detalhe ? (
            <ViagemDetalhe detalhe={detalhe} hrefFechar={hrefViagens(params, { viagem: undefined })} />
          ) : (
            <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-center text-sm text-gray-600 dark:text-gray-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-8 w-8 text-gray-400">
                <path d="M3 17h2l1-5h11l2 5h2M7 17a2 2 0 1 0 0 .01M17 17a2 2 0 1 0 0 .01M6 12l2-5h8l2 5" />
              </svg>
              {params.viagem
                ? "Viagem não encontrada."
                : "Clique numa viagem para ver os pedágios dela."}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
