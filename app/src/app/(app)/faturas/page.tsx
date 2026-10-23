import { getFaturaResumo, listFaturas } from "@/features/faturas/queries";
import { FiltrosForm, FILTROS_FORM_ID } from "@/features/faturas/components/filtros-form";
import { FaturasTable } from "@/features/faturas/components/faturas-table";
import { FaturaPainel } from "@/features/faturas/components/fatura-painel";
import { DetalheVazio, ListaComPainel } from "@/components/layout/lista-com-painel";
import { Paginacao } from "@/components/ui/paginacao";
import { hrefCom } from "@/lib/href";

const BASE = "/faturas";
const ICONE_FATURA = "M7 3h10v18l-3-2-2 2-2-2-3 2zM10 8h4M10 12h4";

type SearchParams = {
  busca?: string;
  dataInicio?: string;
  dataFim?: string;
  pagina?: string;
  // fatura aberta no painel de detalhe ("sem-fatura" = linhas sem número)
  fatura?: string;
};

export default async function FaturasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const pagina = params.pagina ? Number(params.pagina) : 1;

  const [{ erro, rows, total, totalPaginas }, detalhe] = await Promise.all([
    listFaturas({
      busca: params.busca,
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
      pagina,
    }),
    params.fatura
      ? getFaturaResumo(params.fatura === "sem-fatura" ? null : params.fatura)
      : Promise.resolve(null),
  ]);

  return (
    <ListaComPainel
      titulo="Faturas"
      total={total}
      unidade="fatura(s)"
      erro={erro}
      busca={{ formId: FILTROS_FORM_ID, valor: params.busca, placeholder: "Buscar número da fatura" }}
      filtros={<FiltrosForm valores={params} />}
      detalhe={
        detalhe ? (
          <FaturaPainel fatura={detalhe} hrefFechar={hrefCom(BASE, params, { fatura: undefined })} />
        ) : (
          <DetalheVazio icone={ICONE_FATURA}>
            {params.fatura ? "Fatura não encontrada." : "Clique numa fatura para ver o resumo dela."}
          </DetalheVazio>
        )
      }
    >
      <FaturasTable rows={rows} searchParams={params} faturaAtiva={params.fatura} />
      <Paginacao base={BASE} pagina={pagina} totalPaginas={totalPaginas} searchParams={params} />
    </ListaComPainel>
  );
}
