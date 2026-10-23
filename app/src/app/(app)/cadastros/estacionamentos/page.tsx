import { getMeuPapel } from "@/lib/auth/guards";
import { listEstacionamentos } from "@/features/cadastros/queries";
import { EstacionamentoList } from "@/features/cadastros/components/estacionamento-list";
import { ListaComPainel } from "@/components/layout/lista-com-painel";
import { GrupoRadio, PainelFiltros } from "@/components/ui/filtros";
import { LinkButton } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { formatNumber } from "@/lib/format";
import { contem } from "@/lib/texto";

const FORM_ID = "filtros-estacionamentos";

type SearchParams = { busca?: string; cadastro?: string };

export default async function EstacionamentosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [params, estacionamentos, papel] = await Promise.all([searchParams, listEstacionamentos(), getMeuPapel()]);
  const pendentes = estacionamentos.filter((e) => e.cadastro_pendente).length;

  const base = estacionamentos.filter((e) => contem(params.busca, e.nome));
  const rows =
    params.cadastro === "pendente"
      ? base.filter((e) => e.cadastro_pendente)
      : params.cadastro === "completo"
        ? base.filter((e) => !e.cadastro_pendente)
        : base;

  return (
    <ListaComPainel
      titulo="Estacionamentos"
      total={rows.length}
      unidade="estacionamento(s)"
      busca={{ formId: FORM_ID, valor: params.busca, placeholder: "Buscar nome" }}
      acoes={papel === "admin" && <LinkButton href="/cadastros/estacionamentos/novo">Novo estacionamento</LinkButton>}
      filtros={
        <PainelFiltros id={FORM_ID} limparHref="/cadastros/estacionamentos">
          <GrupoRadio
            legenda="Cadastro"
            name="cadastro"
            valor={params.cadastro ?? ""}
            opcoes={[
              { value: "", label: "Todos" },
              {
                value: "pendente",
                label: "Pendente (sem polígono)",
                qtd: base.filter((e) => e.cadastro_pendente).length,
                corQtd: "font-semibold text-amber-700 dark:text-amber-400",
              },
              { value: "completo", label: "Completo", qtd: base.filter((e) => !e.cadastro_pendente).length },
            ]}
          />
        </PainelFiltros>
      }
    >
      {pendentes > 0 && (
        <div className="mb-3">
          <Alert variant="warning">
            {formatNumber(pendentes)} estacionamento(s) criado(s) automaticamente pela importação da
            fatura, só com o nome da planilha. Até o polígono ser desenhado, as passagens desses
            estacionamentos ficam como &quot;Sem cadastro&quot;.{" "}
            {papel === "admin"
              ? "Abra cada um para completar o cadastro — ao salvar, as passagens são revalidadas."
              : "Peça a um administrador para completar o cadastro."}
          </Alert>
        </div>
      )}
      <EstacionamentoList rows={rows} isAdmin={papel === "admin"} />
    </ListaComPainel>
  );
}
