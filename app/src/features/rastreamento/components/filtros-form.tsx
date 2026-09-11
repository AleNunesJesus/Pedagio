import Link from "next/link";
import { SelectField, TextField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type Opcao = { id: string; nome: string };

type FiltrosFormProps = {
  veiculos: Opcao[];
  valores: {
    veiculoId?: string;
    dataInicio?: string;
    dataFim?: string;
  };
};

export function FiltrosForm({ veiculos, valores }: FiltrosFormProps) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <SelectField
        id="veiculoId"
        name="veiculoId"
        label="Veículo"
        placeholder="Selecione"
        defaultValue={valores.veiculoId ?? ""}
        options={veiculos.map((v) => ({ value: v.id, label: v.nome }))}
      />
      <TextField
        id="dataInicio"
        name="dataInicio"
        label="De"
        type="date"
        defaultValue={valores.dataInicio ?? ""}
      />
      <TextField
        id="dataFim"
        name="dataFim"
        label="Até"
        type="date"
        defaultValue={valores.dataFim ?? ""}
      />
      <Button type="submit">Filtrar</Button>
      <Link
        href="/rastreamento"
        className="text-sm text-gray-500 hover:underline dark:text-gray-400"
      >
        Limpar
      </Link>
    </form>
  );
}
