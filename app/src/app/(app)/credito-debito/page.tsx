import { listCreditoDebitoPorViagem } from "@/features/credito-debito/queries";
import { listEmbarcadores } from "@/features/cadastros/queries";
import { FiltrosForm, FILTROS_FORM_ID } from "@/features/credito-debito/components/filtros-form";
import { CreditoDebitoTable } from "@/features/credito-debito/components/credito-debito-table";
import type { SituacaoCreditoDebito } from "@/features/credito-debito/situacao";
import { ListaComPainel } from "@/components/layout/lista-com-painel";
import { Paginacao } from "@/components/ui/paginacao";

type SearchParams = {
  embarcadorId?: string;
  busca?: string;
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

  const [{ erro, rows, total, totalPaginas, contagemPorSituacao }, embarcadores] = await Promise.all([
    listCreditoDebitoPorViagem({
      embarcadorId: params.embarcadorId,
      busca: params.busca,
      situacao: situacaoValida(params.situacao),
      pagina,
    }),
    listEmbarcadores(),
  ]);

  return (
    <ListaComPainel
      titulo="Crédito x débito por viagem"
      total={total}
      unidade="viagem(ns)"
      erro={erro}
      busca={{ formId: FILTROS_FORM_ID, valor: params.busca, placeholder: "Buscar número da viagem" }}
      filtros={
        <FiltrosForm
          embarcadores={embarcadores.map((e) => ({ id: e.id, nome: e.nome }))}
          valores={params}
          contagemPorSituacao={contagemPorSituacao}
        />
      }
    >
      <p className="mb-3 px-1 text-sm text-gray-600 dark:text-gray-400">
        Diferença entre o valor creditado pelo embarcador e o valor debitado na praça, só passagens reais
        com viagem e embarcador identificados. &quot;Situação&quot; mostra se a viagem já tem os dois lados
        ou se um deles ainda está em aberto.
      </p>
      <CreditoDebitoTable rows={rows} />
      <Paginacao base="/credito-debito" pagina={pagina} totalPaginas={totalPaginas} searchParams={params} />
    </ListaComPainel>
  );
}
