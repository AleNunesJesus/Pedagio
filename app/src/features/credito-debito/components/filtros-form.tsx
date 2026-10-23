import { SelectField } from "@/components/ui/field";
import { GrupoRadio, PainelFiltros } from "@/components/ui/filtros";
import { STATUS } from "@/lib/status-validacao";
import { SITUACAO_INFO, type SituacaoCreditoDebito } from "../situacao";

type Opcao = { id: string; nome: string };

// a busca do cabeçalho da página aponta para este form via atributo form=""
export const FILTROS_FORM_ID = "filtros-credito-debito";

type FiltrosFormProps = {
  embarcadores: Opcao[];
  valores: {
    embarcadorId?: string;
    situacao?: string;
  };
  contagemPorSituacao: Record<SituacaoCreditoDebito, number>;
};

export function FiltrosForm({ embarcadores, valores, contagemPorSituacao }: FiltrosFormProps) {
  return (
    <PainelFiltros id={FILTROS_FORM_ID} limparHref="/credito-debito">
      <GrupoRadio
        legenda="Situação"
        name="situacao"
        valor={valores.situacao ?? ""}
        opcoes={[
          { value: "", label: "Todas" },
          ...(Object.entries(SITUACAO_INFO) as [SituacaoCreditoDebito, (typeof SITUACAO_INFO)[SituacaoCreditoDebito]][]).map(
            ([value, info]) => ({
              value,
              label: info.label,
              cor: STATUS[info.role],
              qtd: contagemPorSituacao[value],
            }),
          ),
        ]}
      />
      <SelectField
        id="embarcadorId"
        name="embarcadorId"
        label="Embarcador"
        placeholder="Todos"
        defaultValue={valores.embarcadorId ?? ""}
        options={embarcadores.map((e) => ({ value: e.id, label: e.nome }))}
      />
    </PainelFiltros>
  );
}
