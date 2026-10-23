import { SelectField, TextField } from "@/components/ui/field";
import { GrupoRadio, PainelFiltros } from "@/components/ui/filtros";

type Opcao = { id: string; nome: string };

// a busca do cabeçalho da página aponta para este form via atributo form=""
export const FILTROS_FORM_ID = "filtros-viagens";

type FiltrosFormProps = {
  veiculos: Opcao[];
  embarcadores: Opcao[];
  valores: {
    veiculoId?: string;
    tipoViagem?: string;
    embarcadorId?: string;
    divergencia?: string;
    dataInicio?: string;
    dataFim?: string;
  };
  contagens: {
    tipo: { carregado: number; vazio: number };
    divergencia: { mais: number; menos: number; zero: number };
  };
};

export function FiltrosForm({ veiculos, embarcadores, valores, contagens }: FiltrosFormProps) {
  return (
    <PainelFiltros id={FILTROS_FORM_ID} limparHref="/viagens-transporte">
      <div className="space-y-3">
        <TextField
          id="dataInicio"
          name="dataInicio"
          label="Saída de"
          type="date"
          defaultValue={valores.dataInicio ?? ""}
        />
        <TextField id="dataFim" name="dataFim" label="Saída até" type="date" defaultValue={valores.dataFim ?? ""} />
      </div>

      <GrupoRadio
        legenda="Tipo"
        name="tipoViagem"
        valor={valores.tipoViagem ?? ""}
        opcoes={[
          { value: "", label: "Todos" },
          { value: "carregado", label: "Carregado", qtd: contagens.tipo.carregado },
          { value: "vazio", label: "Vazio", qtd: contagens.tipo.vazio },
        ]}
      />

      <GrupoRadio
        legenda="Divergência"
        name="divergencia"
        valor={valores.divergencia ?? ""}
        opcoes={[
          { value: "", label: "Todas" },
          {
            value: "mais",
            label: "Cobrado a mais",
            qtd: contagens.divergencia.mais,
            corQtd: "font-semibold text-red-700 dark:text-red-400",
          },
          {
            value: "menos",
            label: "Cobrado a menos",
            qtd: contagens.divergencia.menos,
            corQtd: "font-semibold text-green-700 dark:text-green-400",
          },
          { value: "zero", label: "Sem divergência", qtd: contagens.divergencia.zero },
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
      <SelectField
        id="veiculoId"
        name="veiculoId"
        label="Veículo"
        placeholder="Todos"
        defaultValue={valores.veiculoId ?? ""}
        options={veiculos.map((v) => ({ value: v.id, label: v.nome }))}
      />
    </PainelFiltros>
  );
}
