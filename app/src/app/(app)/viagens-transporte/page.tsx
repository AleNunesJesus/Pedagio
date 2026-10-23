import { listVeiculos, listEmbarcadores } from "@/features/cadastros/queries";
import { getViagemDetalhe, listViagensTransporte } from "@/features/viagens-transporte/queries";
import { FiltrosForm, FILTROS_FORM_ID } from "@/features/viagens-transporte/components/filtros-form";
import { ViagensTable } from "@/features/viagens-transporte/components/viagens-table";
import { ViagemDetalhe } from "@/features/viagens-transporte/components/viagem-detalhe";
import { DetalheVazio, ListaComPainel } from "@/components/layout/lista-com-painel";
import { Paginacao } from "@/components/ui/paginacao";
import { getMeuPapel } from "@/lib/auth/guards";
import { hrefCom } from "@/lib/href";

const BASE = "/viagens-transporte";
const ICONE_VIAGEM = "M3 17h2l1-5h11l2 5h2M7 17a2 2 0 1 0 0 .01M17 17a2 2 0 1 0 0 .01M6 12l2-5h8l2 5";

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
    <ListaComPainel
      titulo="Viagens"
      total={total}
      unidade="viagem(ns)"
      erro={erro}
      busca={{ formId: FILTROS_FORM_ID, valor: params.busca, placeholder: "Buscar transporte ou placa" }}
      filtros={
        <FiltrosForm
          veiculos={veiculos.map((v) => ({ id: v.id, nome: v.placa }))}
          embarcadores={embarcadores.map((e) => ({ id: e.id, nome: e.nome }))}
          valores={params}
          contagens={contagens}
        />
      }
      detalhe={
        detalhe ? (
          <ViagemDetalhe detalhe={detalhe} hrefFechar={hrefCom(BASE, params, { viagem: undefined })} />
        ) : (
          <DetalheVazio icone={ICONE_VIAGEM}>
            {params.viagem ? "Viagem não encontrada." : "Clique numa viagem para ver os pedágios dela."}
          </DetalheVazio>
        )
      }
    >
      <ViagensTable
        rows={rows}
        podeExcluir={papel === "admin"}
        searchParams={params}
        viagemAtiva={params.viagem}
      />
      <Paginacao base={BASE} pagina={pagina} totalPaginas={totalPaginas} searchParams={params} />
    </ListaComPainel>
  );
}
