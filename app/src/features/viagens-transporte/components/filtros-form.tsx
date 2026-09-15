import Link from "next/link";
import { SelectField, TextField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type Opcao = { id: string; nome: string };

type FiltrosFormProps = {
  veiculos: Opcao[];
  embarcadores: Opcao[];
  valores: {
    numeroTransporte?: string;
    veiculoId?: string;
    tipoViagem?: string;
    embarcadorId?: string;
    dataInicio?: string;
    dataFim?: string;
  };
};

const OPCOES_TIPO_VIAGEM = [
  { value: "carregado", label: "Carregado" },
  { value: "vazio", label: "Vazio" },
];

export function FiltrosForm({ veiculos, embarcadores, valores }: FiltrosFormProps) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <TextField
        id="numeroTransporte"
        name="numeroTransporte"
        label="Transporte"
        placeholder="Número do transporte"
        defaultValue={valores.numeroTransporte ?? ""}
      />
      <SelectField
        id="veiculoId"
        name="veiculoId"
        label="Veículo"
        placeholder="Todos"
        defaultValue={valores.veiculoId ?? ""}
        options={veiculos.map((v) => ({ value: v.id, label: v.nome }))}
      />
      <SelectField
        id="tipoViagem"
        name="tipoViagem"
        label="Tipo"
        placeholder="Todos"
        defaultValue={valores.tipoViagem ?? ""}
        options={OPCOES_TIPO_VIAGEM}
      />
      <SelectField
        id="embarcadorId"
        name="embarcadorId"
        label="Embarcador"
        placeholder="Todos"
        defaultValue={valores.embarcadorId ?? ""}
        options={embarcadores.map((e) => ({ value: e.id, label: e.nome }))}
      />
      <TextField
        id="dataInicio"
        name="dataInicio"
        label="Saída de"
        type="date"
        defaultValue={valores.dataInicio ?? ""}
      />
      <TextField
        id="dataFim"
        name="dataFim"
        label="Saída até"
        type="date"
        defaultValue={valores.dataFim ?? ""}
      />
      <Button type="submit">Filtrar</Button>
      <Link
        href="/viagens-transporte"
        className="text-sm text-gray-500 hover:underline dark:text-gray-400"
      >
        Limpar
      </Link>
    </form>
  );
}
