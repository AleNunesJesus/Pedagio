import { STATUS, STATUS_VALIDACAO_INFO } from "@/lib/status-validacao";
import { OPCOES_TIPO_USO } from "@/lib/tipo-uso";
import { OPCOES_MOTIVO_VALOR } from "@/lib/motivo-valor";
import { SelectField, TextField } from "@/components/ui/field";
import { GrupoRadio, PainelFiltros } from "@/components/ui/filtros";

type Opcao = { id: string; nome: string };

// a busca do cabeçalho da página aponta para este form via atributo form=""
export const FILTROS_FORM_ID = "filtros-passagens";

type FiltrosFormProps = {
  pracas: Opcao[];
  veiculos: Opcao[];
  embarcadores: Opcao[];
  valores: {
    status?: string;
    pracaId?: string;
    veiculoId?: string;
    tipoUso?: string;
    motivo?: string;
    embarcadorId?: string;
    viagem?: string;
    dataInicio?: string;
    dataFim?: string;
  };
  contagemPorStatus: Record<string, number>;
};

export function FiltrosForm({ pracas, veiculos, embarcadores, valores, contagemPorStatus }: FiltrosFormProps) {
  return (
    <PainelFiltros id={FILTROS_FORM_ID} limparHref="/passagens">
      <div className="space-y-3">
        <TextField id="dataInicio" name="dataInicio" label="De" type="date" defaultValue={valores.dataInicio ?? ""} />
        <TextField id="dataFim" name="dataFim" label="Até" type="date" defaultValue={valores.dataFim ?? ""} />
      </div>

      <GrupoRadio
        legenda="Status"
        name="status"
        valor={valores.status ?? ""}
        opcoes={[
          { value: "", label: "Todos" },
          ...Object.entries(STATUS_VALIDACAO_INFO)
            .map(([value, info]) => ({
              value,
              label: info.label,
              cor: STATUS[info.role],
              qtd: contagemPorStatus[value] ?? 0,
            }))
            // status zerados só aparecem se estiverem escolhidos
            .filter((o) => o.qtd > 0 || o.value === valores.status),
        ]}
      />

      <SelectField
        id="pracaId"
        name="pracaId"
        label="Praça"
        placeholder="Todas"
        defaultValue={valores.pracaId ?? ""}
        options={pracas.map((p) => ({ value: p.id, label: p.nome }))}
      />
      <SelectField
        id="tipoUso"
        name="tipoUso"
        label="Tipo de uso"
        placeholder="Todos"
        defaultValue={valores.tipoUso ?? ""}
        options={OPCOES_TIPO_USO}
      />
      <SelectField
        id="motivo"
        name="motivo"
        label="Conferência por eixo"
        placeholder="Todas"
        defaultValue={valores.motivo ?? ""}
        options={OPCOES_MOTIVO_VALOR}
      />
      <SelectField
        id="embarcadorId"
        name="embarcadorId"
        label="Embarcador"
        placeholder="Todos"
        defaultValue={valores.embarcadorId ?? ""}
        options={embarcadores.map((e) => ({ value: e.id, label: e.nome }))}
      />
      <SelectField
        id="veiculoId"
        name="veiculoId"
        label="Veículo"
        placeholder="Todos"
        defaultValue={valores.veiculoId ?? ""}
        options={veiculos.map((v) => ({ value: v.id, label: v.nome }))}
      />
      <TextField
        id="viagem"
        name="viagem"
        label="Viagem (fatura)"
        placeholder="Número da viagem"
        defaultValue={valores.viagem ?? ""}
      />
    </PainelFiltros>
  );
}
