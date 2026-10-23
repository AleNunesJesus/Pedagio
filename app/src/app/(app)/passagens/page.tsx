import { getPassagemDetalhe, listPassagens } from "@/features/passagens/queries";
import { listPracas, listVeiculos, listEmbarcadores } from "@/features/cadastros/queries";
import { FiltrosForm, FILTROS_FORM_ID } from "@/features/passagens/components/filtros-form";
import { PassagensTable } from "@/features/passagens/components/passagens-table";
import { PassagemPainel } from "@/features/passagens/components/passagem-painel";
import { DetalheVazio, ListaComPainel } from "@/components/layout/lista-com-painel";
import { Paginacao } from "@/components/ui/paginacao";
import { getMeuPapel } from "@/lib/auth/guards";
import { hrefCom } from "@/lib/href";

const BASE = "/passagens";
const ICONE_PASSAGEM = "M3 20h18M5 20V9l7-5 7 5v11M9 20v-6h6v6";

type SearchParams = {
  busca?: string;
  status?: string;
  pracaId?: string;
  veiculoId?: string;
  tipoUso?: string;
  motivo?: string;
  embarcadorId?: string;
  viagem?: string;
  dataInicio?: string;
  dataFim?: string;
  pagina?: string;
  // passagem aberta no painel de detalhe
  passagem?: string;
};

export default async function PassagensPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const pagina = params.pagina ? Number(params.pagina) : 1;

  const [{ erro, rows, total, totalPaginas, contagemPorStatus }, detalhe, pracas, veiculos, embarcadores, papel] =
    await Promise.all([
      listPassagens({
        busca: params.busca,
        status: params.status,
        pracaId: params.pracaId,
        veiculoId: params.veiculoId,
        tipoUso: params.tipoUso,
        motivo: params.motivo,
        embarcadorId: params.embarcadorId,
        viagem: params.viagem,
        dataInicio: params.dataInicio,
        dataFim: params.dataFim,
        pagina,
      }),
      params.passagem ? getPassagemDetalhe(params.passagem) : Promise.resolve(null),
      listPracas(),
      listVeiculos(),
      listEmbarcadores(),
      getMeuPapel(),
    ]);

  return (
    <ListaComPainel
      titulo="Passagens"
      total={total}
      unidade="passagem(ns)"
      erro={erro}
      busca={{ formId: FILTROS_FORM_ID, valor: params.busca, placeholder: "Buscar placa, fatura ou viagem" }}
      filtros={
        <FiltrosForm
          pracas={pracas.map((p) => ({ id: p.id, nome: p.nome }))}
          veiculos={veiculos.map((v) => ({ id: v.id, nome: v.placa }))}
          embarcadores={embarcadores.map((e) => ({ id: e.id, nome: e.nome }))}
          valores={params}
          contagemPorStatus={contagemPorStatus}
        />
      }
      detalhe={
        detalhe ? (
          <PassagemPainel passagem={detalhe} hrefFechar={hrefCom(BASE, params, { passagem: undefined })} />
        ) : (
          <DetalheVazio icone={ICONE_PASSAGEM}>
            {params.passagem ? "Passagem não encontrada." : "Clique numa passagem para ver o resumo dela."}
          </DetalheVazio>
        )
      }
    >
      <PassagensTable
        rows={rows}
        podeExcluir={papel === "admin"}
        searchParams={params}
        passagemAtiva={params.passagem}
      />
      <Paginacao base={BASE} pagina={pagina} totalPaginas={totalPaginas} searchParams={params} />
    </ListaComPainel>
  );
}
