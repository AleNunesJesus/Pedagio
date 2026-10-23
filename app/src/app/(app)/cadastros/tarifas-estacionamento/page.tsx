import { getMeuPapel } from "@/lib/auth/guards";
import { listTarifasEstacionamento, listEstacionamentos } from "@/features/cadastros/queries";
import { TarifaEstacionamentoForm } from "@/features/cadastros/components/tarifa-estacionamento-form";
import { TarifaEstacionamentoList } from "@/features/cadastros/components/tarifa-estacionamento-list";
import { ListaComPainel, PainelNovo } from "@/components/layout/lista-com-painel";
import { GrupoRadio, PainelFiltros } from "@/components/ui/filtros";
import { contem } from "@/lib/texto";

const FORM_ID = "filtros-tarifas-estacionamento";

type SearchParams = { busca?: string; vigencia?: string };

// vigente = sem fim ou com fim a partir de hoje
function vigente(fim: string | null, hoje: string) {
  return fim === null || fim >= hoje;
}

export default async function TarifasEstacionamentoPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [params, tarifas, estacionamentos, papel] = await Promise.all([
    searchParams,
    listTarifasEstacionamento(),
    listEstacionamentos(),
    getMeuPapel(),
  ]);
  const hoje = new Date().toISOString().slice(0, 10);

  const base = tarifas.filter((t) => contem(params.busca, t.estacionamento?.nome));
  const rows =
    params.vigencia === "vigente"
      ? base.filter((t) => vigente(t.vigencia_fim, hoje))
      : params.vigencia === "encerrada"
        ? base.filter((t) => !vigente(t.vigencia_fim, hoje))
        : base;

  return (
    <ListaComPainel
      titulo="Tarifas de estacionamento"
      total={rows.length}
      unidade="tarifa(s)"
      busca={{ formId: FORM_ID, valor: params.busca, placeholder: "Buscar estacionamento" }}
      filtros={
        <PainelFiltros id={FORM_ID} limparHref="/cadastros/tarifas-estacionamento">
          <GrupoRadio
            legenda="Vigência"
            name="vigencia"
            valor={params.vigencia ?? ""}
            opcoes={[
              { value: "", label: "Todas" },
              { value: "vigente", label: "Vigentes", qtd: base.filter((t) => vigente(t.vigencia_fim, hoje)).length },
              { value: "encerrada", label: "Encerradas", qtd: base.filter((t) => !vigente(t.vigencia_fim, hoje)).length },
            ]}
          />
        </PainelFiltros>
      }
      detalhe={
        papel === "admin" ? (
          <PainelNovo titulo="Nova tarifa de estacionamento">
            {estacionamentos.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Cadastre ao menos um estacionamento antes de definir tarifas.
              </p>
            ) : (
              <TarifaEstacionamentoForm estacionamentos={estacionamentos} />
            )}
          </PainelNovo>
        ) : undefined
      }
    >
      <TarifaEstacionamentoList rows={rows} isAdmin={papel === "admin"} />
    </ListaComPainel>
  );
}
