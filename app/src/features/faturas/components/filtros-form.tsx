import { TextField } from "@/components/ui/field";
import { PainelFiltros } from "@/components/ui/filtros";

// a busca do cabeçalho da página aponta para este form via atributo form=""
export const FILTROS_FORM_ID = "filtros-faturas";

type FiltrosFormProps = {
  valores: {
    dataInicio?: string;
    dataFim?: string;
  };
};

export function FiltrosForm({ valores }: FiltrosFormProps) {
  return (
    <PainelFiltros id={FILTROS_FORM_ID} limparHref="/faturas">
      <div className="space-y-3">
        <TextField
          id="dataInicio"
          name="dataInicio"
          label="Período de"
          type="date"
          defaultValue={valores.dataInicio ?? ""}
        />
        <TextField
          id="dataFim"
          name="dataFim"
          label="Período até"
          type="date"
          defaultValue={valores.dataFim ?? ""}
        />
      </div>
    </PainelFiltros>
  );
}
