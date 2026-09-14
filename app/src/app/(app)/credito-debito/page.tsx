import { listCreditoDebitoPorViagem } from "@/features/credito-debito/queries";
import { listEmbarcadores } from "@/features/cadastros/queries";
import { FiltrosForm } from "@/features/credito-debito/components/filtros-form";
import { CreditoDebitoTable } from "@/features/credito-debito/components/credito-debito-table";
import { Paginacao } from "@/features/credito-debito/components/paginacao";
import type { SituacaoCreditoDebito } from "@/features/credito-debito/situacao";

type SearchParams = {
  embarcadorId?: string;
  viagem?: string;
  situacao?: string;
  pagina?: string;
};

const SITUACOES_VALIDAS: SituacaoCreditoDebito[] = ["ambos", "so_credito", "so_debito"];

function situacaoValida(valor: string | undefined): SituacaoCreditoDebito | undefined {
  return SITUACOES_VALIDAS.find((s) => s === valor);
}

export default async function CreditoDebitoPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const pagina = params.pagina ? Number(params.pagina) : 1;

  const [{ rows, total, totalPaginas }, embarcadores] = await Promise.all([
    listCreditoDebitoPorViagem({
      embarcadorId: params.embarcadorId,
      viagem: params.viagem,
      situacao: situacaoValida(params.situacao),
      pagina,
    }),
    listEmbarcadores(),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Crédito x débito por viagem
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {total} viagem(ns) encontrada(s). Diferença entre o valor creditado
          pelo embarcador e o valor debitado na praça, só passagens reais
          com viagem e embarcador identificados. &quot;Situação&quot; mostra se
          a viagem já tem os dois lados ou se um deles ainda está em aberto.
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <FiltrosForm
          embarcadores={embarcadores.map((e) => ({ id: e.id, nome: e.nome }))}
          valores={params}
        />
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <CreditoDebitoTable rows={rows} />
        <Paginacao pagina={pagina} totalPaginas={totalPaginas} searchParams={params} />
      </section>
    </main>
  );
}
